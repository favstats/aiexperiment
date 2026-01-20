# ============================================================
# Political Text Post Generator
# ============================================================

library(tidyverse)
library(httr2)
library(glue)
library(cli)
library(jsonlite)

# ============================================================
# Configuration
# ============================================================
thekey <- Sys.getenv("gemini")

config <- list(
  api_key    = thekey,
  model      = "gemini-3-pro-preview",  # Alternatives: gemini-1.5-flash, gemini-2.0-flash-exp
  output_dir = "generated_texts",
  n_posts    = 3,
  rate_limit = 1  # seconds between requests
)

# ============================================================
# Load Data
# ============================================================

data_url <- "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyLbbFkD7PZovG5dcsR77xG9KUX7ZZd6slVMK5-nGa-1MRioNkuIK4LZETy2DFHnhhbYTgi4GtmOUx/pub?gid=272960022&single=true&output=csv"

df <- read_csv(data_url, show_col_types = FALSE) |>
  filter(!is.na(condition_id)) |>
  filter(!is.na(text_prompt) & text_prompt != "#REF!")

cli_alert_info("Loaded {nrow(df)} rows with valid text prompts")

# ============================================================
# API Function
# ============================================================

generate_texts <- function(prompt, config, max_retries = 5) {
  url <- glue(
    "https://generativelanguage.googleapis.com/v1beta/models/{config$model}:generateContent",
    "?key={config$api_key}"
  )

  # Append JSON schema instruction to prompt
  full_prompt <- paste0(
    prompt,
    '\n\nOutput as JSON: {"posts": ["post1", "post2", "post3"]}'
  )

  body <- list(
    contents = list(list(parts = list(list(text = full_prompt)))),
    generationConfig = list(
      responseMimeType = "application/json"
    )
  )

  # Retry logic with exponential backoff
  for (attempt in 1:max_retries) {
    tryCatch({
      resp <- request(url) |>
        req_headers(`Content-Type` = "application/json") |>
        req_body_json(body) |>
        req_timeout(120) |>
        req_perform() |>
        resp_body_json()

      # Check if response has candidates
      if (is.null(resp$candidates) || length(resp$candidates) == 0) {
        # Check for blocking/safety reasons
        if (!is.null(resp$promptFeedback)) {
          block_reason <- resp$promptFeedback$blockReason %||% "unknown"
          safety_ratings <- resp$promptFeedback$safetyRatings
          safety_info <- ""
          if (!is.null(safety_ratings)) {
            safety_info <- paste(
              sapply(safety_ratings, function(x) paste0(x$category, ": ", x$probability)),
              collapse = ", "
            )
          }
          stop(glue("API blocked prompt. Reason: {block_reason}. Safety: {safety_info}"))
        }
        stop(glue("API returned no candidates. Full response: {jsonlite::toJSON(resp, auto_unbox = TRUE)}"))
      }

      # Check candidate finish reason
      candidate <- resp$candidates[[1]]
      finish_reason <- candidate$finishReason %||% "unknown"

      if (finish_reason != "STOP" && finish_reason != "unknown") {
        safety_ratings <- candidate$safetyRatings
        safety_info <- ""
        if (!is.null(safety_ratings)) {
          safety_info <- paste(
            sapply(safety_ratings, function(x) paste0(x$category, ": ", x$probability)),
            collapse = ", "
          )
        }
        stop(glue("Generation stopped. Reason: {finish_reason}. Safety: {safety_info}"))
      }

      # Check if content exists
      if (is.null(candidate$content) || is.null(candidate$content$parts)) {
        stop(glue("No content in response. Finish reason: {finish_reason}"))
      }

      # Extract text and parse JSON
      parts <- candidate$content$parts
      text_parts <- keep(parts, ~ !is.null(.x$text))

      if (length(text_parts) == 0) {
        stop("No text in response")
      }

      json_text <- text_parts[[1]]$text
      parsed <- fromJSON(json_text)

      # Validate structure
      if (is.null(parsed$posts) || !is.character(parsed$posts)) {
        stop(glue("Invalid JSON structure. Expected 'posts' array. Got: {json_text}"))
      }

      return(parsed)

    }, error = function(e) {
      if (grepl("429|Too Many Requests|rate|RESOURCE_EXHAUSTED", e$message, ignore.case = TRUE)) {
        wait_time <- 30 * (2 ^ (attempt - 1))  # 30s, 60s, 120s, 240s, 480s
        cli_alert_warning("    Rate limited! Waiting {wait_time}s before retry {attempt}/{max_retries}...")
        Sys.sleep(wait_time)
        if (attempt == max_retries) {
          stop(e$message)
        }
      } else {
        stop(e$message)
      }
    })
  }
}

# ============================================================
# Check existing texts
# ============================================================

check_existing_texts <- function(condition_dir, n_required) {
  texts_file <- file.path(condition_dir, "texts.json")

  if (!file.exists(texts_file)) {
    return(list(complete = FALSE, existing_count = 0))
  }

  tryCatch({
    existing <- fromJSON(texts_file)
    n_existing <- length(existing$posts)

    list(
      complete = n_existing >= n_required,
      existing_count = n_existing
    )
  }, error = function(e) {
    list(complete = FALSE, existing_count = 0)
  })
}

# ============================================================
# Save texts
# ============================================================

save_texts <- function(texts_data, filepath) {
  json_output <- toJSON(texts_data, auto_unbox = TRUE, pretty = TRUE)
  write_lines(json_output, filepath)
  filepath
}

# ============================================================
# Main Loop
# ============================================================

generate_all_texts <- function(df, config, sample_n = NULL) {

  # Optional: sample for testing
  if (!is.null(sample_n)) {
    df <- slice_sample(df, n = sample_n)
    cli_alert_info("Sampled {nrow(df)} rows for testing")
  }

  dir.create(config$output_dir, showWarnings = FALSE, recursive = TRUE)

  # Pre-filter: Check which conditions need generation BEFORE the loop
  cli_h1("Checking existing texts")
  needs_generation <- logical(nrow(df))

  for (i in seq_len(nrow(df))) {
    condition_id <- df$condition_id[i]
    condition_dir <- file.path(config$output_dir, condition_id)

    if (dir.exists(condition_dir)) {
      existing_info <- check_existing_texts(condition_dir, config$n_posts)
      needs_generation[i] <- !existing_info$complete
    } else {
      needs_generation[i] <- TRUE
    }
  }

  df_to_process <- df[needs_generation, ]
  skipped_count <- sum(!needs_generation)

  cli_h1("Generating Texts")
  cli_alert_info("Model: {config$model}")
  cli_alert_info("Posts per condition: {config$n_posts}")
  cli_alert_info("Conditions needing generation: {nrow(df_to_process)}")
  cli_alert_info("Conditions already complete: {skipped_count}")

  results <- list()

  for (i in seq_len(nrow(df_to_process))) {
    row <- df_to_process[i, ]
    condition_id <- row$condition_id
    prompt <- row$text_prompt

    cli_h2("[{i}/{nrow(df_to_process)}] {condition_id}")
    cli_text("{str_trunc(prompt, 80)}")

    # Create folder for this condition
    condition_dir <- file.path(config$output_dir, condition_id)
    dir.create(condition_dir, showWarnings = FALSE, recursive = TRUE)

    # Save prompt
    write_lines(prompt, file.path(condition_dir, "prompt.txt"))

    # Generate texts
    tryCatch({
      texts_data <- generate_texts(prompt, config)
      texts_file <- file.path(condition_dir, "texts.json")
      save_texts(texts_data, texts_file)

      n_posts <- length(texts_data$posts)
      cli_alert_success("  Generated {n_posts} posts -> texts.json")

      results[[i]] <- tibble(
        condition_id = condition_id,
        n_posts = n_posts,
        filepath = texts_file,
        status = "success"
      )

    }, error = function(e) {
      cli_alert_danger("  Failed: {e$message}")
      results[[i]] <- tibble(
        condition_id = condition_id,
        n_posts = 0,
        filepath = NA_character_,
        status = "error"
      )
    })

    Sys.sleep(config$rate_limit)
  }

  # Combine results
  results_df <- bind_rows(results)
  write_csv(results_df, file.path(config$output_dir, "generation_log.csv"))

  # Summary
  cli_h1("Complete")
  generated <- sum(results_df$status == "success", na.rm = TRUE)
  errors <- sum(results_df$status == "error", na.rm = TRUE)

  cli_alert_success("Generated: {generated} conditions")
  cli_alert_info("Conditions skipped (already complete): {skipped_count}")
  if (errors > 0) {
    cli_alert_danger("Failed: {errors}")
  }

  results_df
}

# ============================================================
# Run
# ============================================================

# Filter to specific issues (same as gen.R)
three_issues <- df %>%
  dplyr::filter(str_detect(condition_id, pattern = "israel|power|home|childcare|climate"))

# Generate texts:
results <- generate_all_texts(three_issues, config)

# Run all (uncomment when ready):
# results <- generate_all_texts(df, config)
