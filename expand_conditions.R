# ============================================================
# Expand Conditions for Israel, Purchasing Power, and Public Transport
# ============================================================
# This script expands the conditions to include all combinations of:
# - Age groups: 18-29, 30-44, 45-59, 60+
# - Genders: male, female
# - Ideologies: leftist, centrist, rightist
# For issues that currently only have partial coverage

library(tidyverse)

# ============================================================
# Define the base data for each issue-ideology combination
# ============================================================

# Define all age groups and genders
age_groups <- c("18–29", "30-44", "45-59", "60+")
age_ids <- c("18-29", "30-44", "45-59", "60+")  # For condition_id (no en-dash)
genders <- c("male", "female")
ideologies <- c("leftist", "centrist", "rightist")

# ============================================================
# ISRAEL - Stop weapon shipments to Israel
# Currently only has 60+ age group
# ============================================================

israel_base <- tribble(
  ~ideology, ~scenarios, ~slogan, ~outgroup, ~values,
  
  "leftist",
  "• Person X stands in the harbour holding a piece candle while ships that deliver weaponry in large containers pass by",
  "Jij wilt vrede, zij voeden het geweld",
  "Right-Wingers (Interventionist Faction) — back unconditional arms support for Israel, dismiss civilian suffering, and block calls for ceasefire or diplomacy",
  "emphasize frames of solidarity, justice, equality, and community and related concepts",
  
  "centrist",
  "• Person X stands near a cargo hub with shipping containers and looks upset at left- and right-wing protesters who drown out voices calling for de-escalation.",
  "Jij wilt levens redden, zij stoken het vuur van alle kanten",
  "Right-Wingers (Interventionist Faction) — push endless weapons to Israel, choose war over peace, and ignore the human cost in Palestina; Left-Wingers (Anti-Israel Faction) — reduce the conflict to slogans, reject nuance, and block practical steps toward de-escalation",
  "emphasize frames of pragmatism, reason, balance, rejection of blind ideologues on either side, and related concepts",
  
  "rightist",
  "• Person X sits at home reading a newspaper with war headlines, looks upset, and feels frustrated that Anti-Israel extremists turn every debate into calls for total isolation instead of real peace efforts.",
  "Jij wilt vrede, zij voeden het geweld",
  "Left-Wingers (Anti-Israel Faction) — pro Hamas extremists push to isolate Israel completely, no matter the consequences for diplomacy or security",
  "emphasize frames of nation, strength, order, loyalty and related concepts"
)

israel_expanded <- expand_grid(
  age_group = age_groups,
  gender = genders
) %>%
  cross_join(israel_base) %>%
  mutate(
    age_id = case_when(
      age_group == "18–29" ~ "18-29",
      TRUE ~ age_group
    ),
    policy_issue = "Stop weapon shipments to Israel",
    ideology_congruency = ideology,
    condition_id = paste0(age_id, "_", gender, "_stop_weapon_ship_to_israel_", ideology)
  ) %>%
  select(
    condition_id,
    age_group,
    gender,
    policy_issue,
    ideology_congruency,
    scenarios,
    slogan,
    outgroup,
    values
  )

# ============================================================
# PURCHASING POWER - Strengthen purchasing power (cost of living)
# Currently only has 18-29 age group
# ============================================================

purchasing_base <- tribble(
  ~ideology, ~scenarios, ~slogan, ~outgroup, ~values,
  
  "leftist",
  "• Person X sits in a cold room. Outside are right-wing budget-hawks who profit from massive budget cuts",
  "Jij schrapt de verwarming, zij schrappen belastingen voor rijken",
  "Right-Wingers (Tax-Cut-First Faction) — prioritise broad tax cuts over calibrated koopkracht measures when prices bite low-/middle-income households.",
  "emphasize frames of solidarity, justice, equality, and community and related concepts",
  
  "centrist",
  "• Person X checks a shopping receipt at the supermarket and looks hopeless, while politicians are unable to solve the issue",
  "Jij rekent elke euro, zij rekenen op jouw euro",
  "Right-Wingers (Tax-Cut-First Faction) — prioritise broad tax cuts over calibrated koopkracht measures when prices bite low-/middle-income households.; Left-Wingers (Pro-Spending Faction) — universal entitlements raise taxes/fees, dull work incentives.",
  "emphasize frames of pragmatism, reason, balance, rejection of blind ideologues on either side, and related concepts",
  
  "rightist",
  "• Person X stands in a supermarket and looks frustrated at rising prices, while left-wing politicians provide generous handouts to everyone else but you",
  "Jij ziet je koopkracht stilstaan, zij laten de uitkeringen meestijgen",
  "Left-Wingers (Pro-Spending Faction) — universal entitlements raise taxes/fees, dull work incentives.",
  "emphasize frames of nation, strength, order, loyalty and related concepts"
)

purchasing_expanded <- expand_grid(
  age_group = age_groups,
  gender = genders
) %>%
  cross_join(purchasing_base) %>%
  mutate(
    age_id = case_when(
      age_group == "18–29" ~ "18-29",
      TRUE ~ age_group
    ),
    policy_issue = "Strengthen purchasing power (cost of living)",
    ideology_congruency = ideology,
    condition_id = paste0(age_id, "_", gender, "_purchasing_power_", ideology)
  ) %>%
  select(
    condition_id,
    age_group,
    gender,
    policy_issue,
    ideology_congruency,
    scenarios,
    slogan,
    outgroup,
    values
  )

# ============================================================
# PUBLIC TRANSPORT - Improve public transport (accessibility)
# Currently only has 18-29 age group (with typo as 18-24 in condition_id)
# ============================================================

transport_base <- tribble(
  ~ideology, ~scenarios, ~slogan, ~outgroup, ~values,
  
  "leftist",
  "• Person X taps OVpay at a station gate; the reader errors and they look frustrated as a small queue forms.
• Person X waits in the rain at a rural stop; the bus is cancelled on the display and they look cold and annoyed.
• Person X finds the station lift out of order with a stroller/wheelchair and looks stranded at the stairs.
• Person X misses a tight connection; the board shows 'delayed / 30 min wait' and they look exasperated.
• Person X checks the journey planner for late evening; only 'no service / hourly only' appears and they look worried.
• Person X tries to board a zero-emission bus; it's overcrowded and departs full and they look left behind.",
  "Voor OV dat werkt",
  "Right-Wingers (Anti-Spending Faction) — austerity over access; blocks investment, staffing, and frequency;",
  "emphasize frames of solidarity, justice, equality, and community and related concepts",
  
  "centrist",
  "• Person X taps OVpay at a station gate; the reader errors and they look frustrated as a small queue forms.
• Person X waits in the rain at a rural stop; the bus is cancelled on the display and they look cold and annoyed.
• Person X finds the station lift out of order with a stroller/wheelchair and looks stranded at the stairs.
• Person X misses a tight connection; the board shows 'delayed / 30 min wait' and they look exasperated.
• Person X checks the journey planner for late evening; only 'no service / hourly only' appears and they look worried.
• Person X tries to board a zero-emission bus; it's overcrowded and departs full and they look left behind.",
  "Voor OV dat werkt",
  "Right-Wingers (Anti-Spending Faction) — austerity over access; blocks investment, staffing, and frequency; Left-Wingers (Eco-Regulationist Faction) — layers of environmental/permit demands that delay lines & upgrades",
  "emphasize frames of pragmatism, reason, balance, rejection of blind ideologues on either side, and related concepts",
  
  "rightist",
  "• Person X taps OVpay at a station gate; the reader errors and they look frustrated as a small queue forms.
• Person X waits in the rain at a rural stop; the bus is cancelled on the display and they look cold and annoyed.
• Person X finds the station lift out of order with a stroller/wheelchair and looks stranded at the stairs.
• Person X misses a tight connection; the board shows 'delayed / 30 min wait' and they look exasperated.
• Person X checks the journey planner for late evening; only 'no service / hourly only' appears and they look worried.
• Person X tries to board a zero-emission bus; it's overcrowded and departs full and they look left behind.",
  "Voor OV dat werkt",
  "Left-Wingers (Eco-Regulationist Faction) — layers of environmental/permit demands that delay lines & upgrades",
  "emphasize frames of nation, strength, order, loyalty and related concepts"
)

transport_expanded <- expand_grid(
  age_group = age_groups,
  gender = genders
) %>%
  cross_join(transport_base) %>%
  mutate(
    age_id = case_when(
      age_group == "18–29" ~ "18-29",
      TRUE ~ age_group
    ),
    policy_issue = "Improve public transport (accessibility)",
    ideology_congruency = ideology,
    condition_id = paste0(age_id, "_", gender, "_Improve_public_transport_accessibility_", ideology)
  ) %>%
  select(
    condition_id,
    age_group,
    gender,
    policy_issue,
    ideology_congruency,
    scenarios,
    slogan,
    outgroup,
    values
  )

# ============================================================
# Combine all expanded conditions
# ============================================================

all_expanded <- bind_rows(
  israel_expanded,
  purchasing_expanded,
  transport_expanded
)

# ============================================================
# Summary
# ============================================================

cat("=== Expanded Conditions Summary ===\n\n")

cat("Israel (Stop weapon shipments):\n")
cat("  Conditions:", nrow(israel_expanded), "\n")
cat("  Age groups:", paste(unique(israel_expanded$age_group), collapse = ", "), "\n")
cat("  Genders:", paste(unique(israel_expanded$gender), collapse = ", "), "\n")
cat("  Ideologies:", paste(unique(israel_expanded$ideology_congruency), collapse = ", "), "\n\n")

cat("Purchasing Power:\n")
cat("  Conditions:", nrow(purchasing_expanded), "\n")
cat("  Age groups:", paste(unique(purchasing_expanded$age_group), collapse = ", "), "\n")
cat("  Genders:", paste(unique(purchasing_expanded$gender), collapse = ", "), "\n")
cat("  Ideologies:", paste(unique(purchasing_expanded$ideology_congruency), collapse = ", "), "\n\n")

cat("Public Transport:\n")
cat("  Conditions:", nrow(transport_expanded), "\n")
cat("  Age groups:", paste(unique(transport_expanded$age_group), collapse = ", "), "\n")
cat("  Genders:", paste(unique(transport_expanded$gender), collapse = ", "), "\n")
cat("  Ideologies:", paste(unique(transport_expanded$ideology_congruency), collapse = ", "), "\n\n")

cat("Total expanded conditions:", nrow(all_expanded), "\n")

# ============================================================
# Preview
# ============================================================

cat("\n=== Preview of condition_ids ===\n\n")
all_expanded %>%
  select(condition_id, age_group, gender, policy_issue, ideology_congruency) %>%
  print(n = 30)

# ============================================================
# Save to CSV
# ============================================================

write_csv(all_expanded, "expanded_conditions.csv")
cat("\n\n✓ Saved to expanded_conditions.csv\n")

# Also create a version with just the new conditions (excluding those that already exist)
# Based on original data: Israel only had 60+, Purchasing power only had 18-29, Transport only had 18-29

new_israel <- israel_expanded %>%
  filter(age_group != "60+")

new_purchasing <- purchasing_expanded %>%
  filter(age_group != "18–29")

new_transport <- transport_expanded %>%
  filter(age_group != "18–29")

new_conditions_only <- bind_rows(
  new_israel,
  new_purchasing,
  new_transport
)

write_csv(new_conditions_only, "new_conditions_only.csv")
cat("✓ Saved NEW conditions only (excluding existing) to new_conditions_only.csv\n")
cat("  New conditions count:", nrow(new_conditions_only), "\n")
