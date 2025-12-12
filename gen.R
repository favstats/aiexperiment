# ============================================================
# Nano Banana Pro Image Generator
# ============================================================

library(tidyverse)
library(httr2)
library(glue)
library(base64enc)
library(cli)

# ============================================================
# Configuration
# ============================================================

config <- list(
  api_key       = Sys.getenv("gemini"),
  model        = "gemini-3-pro-image-preview",
  image_size   = "1K",
  aspect_ratio = "1:1",
  output_dir   = "generated_images",
  n_images     = 3,
  rate_limit   = 1
)

# ============================================================
# Load Data
# ============================================================

data_url <- "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyLbbFkD7PZovG5dcsR77xG9KUX7ZZd6slVMK5-nGa-1MRioNkuIK4LZETy2DFHnhhbYTgi4GtmOUx/pub?output=csv"

df <- read_csv(data_url, show_col_types = FALSE) |>
  filter(!is.na(condition_id)) |>
  filter(!is.na(image_prompt) & image_prompt != "#REF!") #%>%
# sample_n(2)

cli_alert_info("Loaded {nrow(df)} rows with valid prompts")

# ============================================================
# API Function
# ============================================================

generate_image <- function(prompt, config) {
  url <- glue(
    "https://generativelanguage.googleapis.com/v1beta/models/{config$model}:generateContent",
    "?key={config$api_key}"
  )

  body <- list(
    contents = list(list(parts = list(list(text = prompt)))),
    generationConfig = list(
      responseModalities = list("TEXT", "IMAGE"),
      imageConfig = list(
        imageSize = config$image_size,
        aspectRatio = config$aspect_ratio
      )
    )
  )

  resp <- request(url) |>
    req_headers(`Content-Type` = "application/json") |>
    req_body_json(body) |>
    req_timeout(180) |>
    req_perform() |>
    resp_body_json()

  # Extract image
  parts <- resp$candidates[[1]]$content$parts
  img_part <- keep(parts, ~ !is.null(.x$inlineData))[[1]]

  img_part$inlineData
}

save_image <- function(image_data, filepath) {
  ext <- if (str_detect(image_data$mimeType, "png")) "png" else "jpg"
  full_path <- glue("{filepath}.{ext}")

  image_data$data |>
    base64decode() |>
    writeBin(full_path)

  full_path
}

# ============================================================
# Check existing images
# ============================================================

check_existing_images <- function(condition_dir, condition_id, n_required) {
  # Count ALL jpg/png files in the folder
  existing_files <- list.files(condition_dir, pattern = "\\.(jpg|png)$", full.names = FALSE)
  existing_count <- length(existing_files)

  # Find highest existing number to know where to continue from
  # Look for patterns like {condition_id}_XX or image_XX
  numbers <- existing_files |>
    str_extract("_(\\d{2})\\.", group = 1) |>
    as.integer()
  numbers <- numbers[!is.na(numbers)]

  max_num <- if (length(numbers) > 0) max(numbers) else 0

  # How many more do we need?
  n_to_generate <- max(0, n_required - existing_count)

  list(
    existing_count = existing_count,
    max_num = max_num,
    n_to_generate = n_to_generate
  )
}

# ============================================================
# Renumber images sequentially (run ONCE after generation is done)
# ============================================================

renumber_images <- function(output_dir) {
  cli_h1("Renumbering all images sequentially (01, 02, 03, ...)")

  condition_dirs <- list.dirs(output_dir, recursive = FALSE, full.names = TRUE)
  renamed_count <- 0

  for (condition_dir in condition_dirs) {
    condition_id <- basename(condition_dir)

    # Find all image files (any pattern with jpg/png)
    image_files <- list.files(condition_dir, pattern = "\\.(jpg|png)$", full.names = TRUE)

    if (length(image_files) == 0) next

    # Sort by modification time (oldest first) to maintain order
    file_info <- file.info(image_files)
    image_files <- image_files[order(file_info$mtime)]

    # Rename to temporary names first to avoid conflicts
    temp_names <- character(length(image_files))
    for (j in seq_along(image_files)) {
      ext <- tools::file_ext(image_files[j])
      temp_name <- file.path(condition_dir, sprintf("__temp_%d__.%s", j, ext))
      file.rename(image_files[j], temp_name)
      temp_names[j] <- temp_name
    }

    # Now rename to final sequential names
    for (j in seq_along(temp_names)) {
      ext <- tools::file_ext(temp_names[j])
      new_name <- sprintf("%s_%02d.%s", condition_id, j, ext)
      new_path <- file.path(condition_dir, new_name)
      file.rename(temp_names[j], new_path)
      renamed_count <- renamed_count + 1
    }

    cli_alert_success("{condition_id}: {length(temp_names)} images renumbered")
  }

  cli_alert_success("Total: {renamed_count} image(s) renumbered")
  renamed_count
}

# ============================================================
# Main Loop
# ============================================================

generate_all <- function(df, config, sample_n = NULL) {

  # Optional: sample for testing
  if (!is.null(sample_n)) {
    df <- slice_sample(df, n = sample_n)
    cli_alert_info("Sampled {nrow(df)} rows for testing")
  }

  dir.create(config$output_dir, showWarnings = FALSE, recursive = TRUE)

  # Pre-filter: Check which conditions need generation BEFORE the loop
  cli_h1("Checking existing images")
  needs_generation <- logical(nrow(df))

  for (i in seq_len(nrow(df))) {
    condition_id <- df$condition_id[i]
    condition_dir <- file.path(config$output_dir, condition_id)

    if (dir.exists(condition_dir)) {
      existing_info <- check_existing_images(condition_dir, condition_id, config$n_images)
      needs_generation[i] <- existing_info$n_to_generate > 0
    } else {
      needs_generation[i] <- TRUE
    }
  }

  df_to_process <- df[needs_generation, ]
  skipped_count <- sum(!needs_generation)

  cli_h1("Generating Images")
  cli_alert_info("Model: {config$model}")
  cli_alert_info("Resolution: {config$image_size} ({config$aspect_ratio})")
  cli_alert_info("Images per prompt: {config$n_images}")
  cli_alert_info("Conditions needing generation: {nrow(df_to_process)}")
  cli_alert_info("Conditions already complete: {skipped_count}")

  results <- list()

  for (i in seq_len(nrow(df_to_process))) {
    row <- df_to_process[i, ]
    condition_id <- row$condition_id
    prompt <- row$image_prompt

    cli_h2("[{i}/{nrow(df_to_process)}] {condition_id}")
    cli_text("{str_trunc(prompt, 60)}")

    # Create folder for this condition
    condition_dir <- file.path(config$output_dir, condition_id)
    dir.create(condition_dir, showWarnings = FALSE, recursive = TRUE)

    # Save prompt
    write_lines(prompt, file.path(condition_dir, "prompt.txt"))

    # Check existing images
    existing_info <- check_existing_images(condition_dir, condition_id, config$n_images)

    cli_alert_info("  Found {existing_info$existing_count} existing images, generating {existing_info$n_to_generate} more")

    # Generate new images starting from max_num + 1
    image_paths <- character(existing_info$n_to_generate)
    statuses <- character(existing_info$n_to_generate)

    for (j in seq_len(existing_info$n_to_generate)) {
      new_num <- existing_info$max_num + j
      tryCatch({
        img_data <- generate_image(prompt, config)
        filepath <- file.path(condition_dir, sprintf("%s_%02d", condition_id, new_num))
        saved_path <- save_image(img_data, filepath)
        image_paths[j] <- saved_path
        statuses[j] <- "success"
        cli_alert_success("  Generated: {basename(saved_path)}")
      }, error = function(e) {
        cli_alert_danger("  Image {new_num} failed: {e$message}")
        image_paths[j] <- NA_character_
        statuses[j] <- "error"
      })

      Sys.sleep(config$rate_limit)
    }

    # Store results
    results[[i]] <- tibble(
      condition_id = condition_id,
      image_num = seq_len(existing_info$n_to_generate) + existing_info$max_num,
      filepath = image_paths,
      status = statuses
    )
  }

  # Skipped conditions don't need to be added to results
  # (they already have all required images)

  # Combine results
  results_df <- bind_rows(results)
  write_csv(results_df, file.path(config$output_dir, "generation_log.csv"))

  # Summary
  cli_h1("Complete")
  generated <- sum(results_df$status == "success", na.rm = TRUE)
  errors <- sum(results_df$status == "error", na.rm = TRUE)

  cli_alert_success("Generated: {generated} images")
  cli_alert_info("Conditions skipped (already complete): {skipped_count}")
  if (errors > 0) {
    cli_alert_danger("Failed: {errors}")
  }

  results_df
}

# ============================================================
# Run
# ============================================================

# childcare, housing, co2 level

three_issues <- df %>%
  # count(policy_issue, sort =T)
  dplyr::filter(str_detect(condition_id, pattern = "home|childcare|climate"))


# Generate images (new images get numbered from max+1):
results <- generate_all(three_issues, config)

# Run all (uncomment when ready):
# results <- generate_all(df, config)

# After ALL generation is done, run ONCE to renumber sequentially (01, 02, 03, ...):
# renumber_images(config$output_dir)
