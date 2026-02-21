-- Migration 007: Seed task templates for all 8 canonical multimodal task types.
-- Each task type is seeded at difficulty levels 2, 4, 6, and 8 for both criteria B and C.
-- The config payload mirrors the buildTaskConfig() schema in lib/multimodal/engine.ts.

begin;

-- ─── Criterion B: Inquiring & Designing ─────────────────────────────────────

-- variable_sorter (B, difficulties 2 4 6 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('Variables • variable sorter', 'variable_sorter', 'B', 2,
   '{"criterion":"B","task_type":"variable_sorter","task_type_ui":"iv_dv_cv_sort","difficulty_level":2,"title":"Variables \u2022 variable sorter","prompt":"Sort IV, DV, and CV correctly for a basic investigation before explaining your choices.","estimated_duration_seconds":240,"simulation_url":null}',
   240),
  ('Variables • variable sorter', 'variable_sorter', 'B', 4,
   '{"criterion":"B","task_type":"variable_sorter","task_type_ui":"iv_dv_cv_sort","difficulty_level":4,"title":"Variables \u2022 variable sorter","prompt":"Sort IV, DV, and CV correctly for an intermediate investigation before explaining your choices.","estimated_duration_seconds":270,"simulation_url":null}',
   270),
  ('Variables • variable sorter', 'variable_sorter', 'B', 6,
   '{"criterion":"B","task_type":"variable_sorter","task_type_ui":"iv_dv_cv_sort","difficulty_level":6,"title":"Variables \u2022 variable sorter","prompt":"Sort IV, DV, and CV correctly for a complex multi-variable scenario and justify each classification.","estimated_duration_seconds":300,"simulation_url":null}',
   300),
  ('Variables • variable sorter', 'variable_sorter', 'B', 8,
   '{"criterion":"B","task_type":"variable_sorter","task_type_ui":"iv_dv_cv_sort","difficulty_level":8,"title":"Variables \u2022 variable sorter","prompt":"Sort IV, DV, and CV for an advanced experimental scenario and explain potential confounding variables.","estimated_duration_seconds":300,"simulation_url":null}',
   300);

-- variable_matching (B, difficulties 2 4 6 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('Variables • variable matching', 'variable_matching', 'B', 2,
   '{"criterion":"B","task_type":"variable_matching","task_type_ui":"matching","difficulty_level":2,"title":"Variables \u2022 variable matching","prompt":"Match each statement to the correct variable role in a simple experiment.","estimated_duration_seconds":240,"simulation_url":null}',
   240),
  ('Variables • variable matching', 'variable_matching', 'B', 4,
   '{"criterion":"B","task_type":"variable_matching","task_type_ui":"matching","difficulty_level":4,"title":"Variables \u2022 variable matching","prompt":"Match each statement to the correct variable role in an intermediate experiment.","estimated_duration_seconds":270,"simulation_url":null}',
   270),
  ('Variables • variable matching', 'variable_matching', 'B', 6,
   '{"criterion":"B","task_type":"variable_matching","task_type_ui":"matching","difficulty_level":6,"title":"Variables \u2022 variable matching","prompt":"Match each statement to the correct variable role including confounding and controlled variables.","estimated_duration_seconds":300,"simulation_url":null}',
   300),
  ('Variables • variable matching', 'variable_matching', 'B', 7,
   '{"criterion":"B","task_type":"variable_matching","task_type_ui":"matching","difficulty_level":7,"title":"Variables \u2022 variable matching","prompt":"Match complex scenario statements to variable roles and justify edge cases.","estimated_duration_seconds":300,"simulation_url":null}',
   300);

-- investigation_design (B, difficulties 6 7 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('Investigation • investigation design', 'investigation_design', 'B', 6,
   '{"criterion":"B","task_type":"investigation_design","task_type_ui":"short_answer","difficulty_level":6,"title":"Investigation \u2022 investigation design","prompt":"Order and justify experimental steps for a fair investigation.","estimated_duration_seconds":360,"simulation_url":null}',
   360),
  ('Investigation • investigation design', 'investigation_design', 'B', 7,
   '{"criterion":"B","task_type":"investigation_design","task_type_ui":"extended_response","difficulty_level":7,"title":"Investigation \u2022 investigation design","prompt":"Design a fair investigation: order the steps, identify controls, and justify your method.","estimated_duration_seconds":420,"simulation_url":null}',
   420),
  ('Investigation • investigation design', 'investigation_design', 'B', 8,
   '{"criterion":"B","task_type":"investigation_design","task_type_ui":"extended_response","difficulty_level":8,"title":"Investigation \u2022 investigation design","prompt":"Design a rigorous investigation including hypothesis, variables, controlled factors, and ethical considerations.","estimated_duration_seconds":480,"simulation_url":null}',
   480);

-- ─── Criterion C: Processing & Evaluating ───────────────────────────────────

-- simulation_data_collection (C, difficulties 3 5 7 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('Data • simulation data collection', 'simulation_data_collection', 'C', 3,
   '{"criterion":"C","task_type":"simulation_data_collection","task_type_ui":"simulation_probe","difficulty_level":3,"title":"Data \u2022 simulation data collection","prompt":"Use the simulation to collect at least 5 data points, then submit your data table.","estimated_duration_seconds":360,"simulation_url":null}',
   360),
  ('Data • simulation data collection', 'simulation_data_collection', 'C', 5,
   '{"criterion":"C","task_type":"simulation_data_collection","task_type_ui":"table_completion","difficulty_level":5,"title":"Data \u2022 simulation data collection","prompt":"Systematically vary the independent variable and record at least 6 data points with observations.","estimated_duration_seconds":420,"simulation_url":null}',
   420),
  ('Data • simulation data collection', 'simulation_data_collection', 'C', 7,
   '{"criterion":"C","task_type":"simulation_data_collection","task_type_ui":"simulation_probe","difficulty_level":7,"title":"Data \u2022 simulation data collection","prompt":"Collect data across the full range of the IV, identify a trend, and note anomalies.","estimated_duration_seconds":480,"simulation_url":null}',
   480),
  ('Data • simulation data collection', 'simulation_data_collection', 'C', 8,
   '{"criterion":"C","task_type":"simulation_data_collection","task_type_ui":"simulation_probe","difficulty_level":8,"title":"Data \u2022 simulation data collection","prompt":"Design your own data collection protocol, collect data, and identify sources of uncertainty.","estimated_duration_seconds":480,"simulation_url":null}',
   480);

-- graph_interpretation (C, difficulties 4 5 7 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('Graph • graph interpretation', 'graph_interpretation', 'C', 4,
   '{"criterion":"C","task_type":"graph_interpretation","task_type_ui":"graph_analysis","difficulty_level":4,"title":"Graph \u2022 graph interpretation","prompt":"Interpret the graph trend and explain one scientific conclusion.","estimated_duration_seconds":270,"simulation_url":null}',
   270),
  ('Graph • graph interpretation', 'graph_interpretation', 'C', 5,
   '{"criterion":"C","task_type":"graph_interpretation","task_type_ui":"graph_analysis","difficulty_level":5,"title":"Graph \u2022 graph interpretation","prompt":"Identify the relationship shown in the graph and explain what it means scientifically.","estimated_duration_seconds":300,"simulation_url":null}',
   300),
  ('Graph • graph interpretation', 'graph_interpretation', 'C', 7,
   '{"criterion":"C","task_type":"graph_interpretation","task_type_ui":"graph_analysis","difficulty_level":7,"title":"Graph \u2022 graph interpretation","prompt":"Analyse the graph fully: describe the trend, identify anomalies, and draw a scientific conclusion with justification.","estimated_duration_seconds":360,"simulation_url":null}',
   360),
  ('Graph • graph interpretation', 'graph_interpretation', 'C', 8,
   '{"criterion":"C","task_type":"graph_interpretation","task_type_ui":"graph_analysis","difficulty_level":8,"title":"Graph \u2022 graph interpretation","prompt":"Evaluate the graph: trend analysis, anomalies, limitations of the data, and a justified conclusion with uncertainty.","estimated_duration_seconds":360,"simulation_url":null}',
   360);

-- claim_evidence_reasoning (C, difficulties 5 6 7 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('CER • claim evidence reasoning', 'claim_evidence_reasoning', 'C', 5,
   '{"criterion":"C","task_type":"claim_evidence_reasoning","task_type_ui":"short_answer","difficulty_level":5,"title":"CER \u2022 claim evidence reasoning","prompt":"Write a claim and support it using evidence from the data artifact.","estimated_duration_seconds":300,"simulation_url":null}',
   300),
  ('CER • claim evidence reasoning', 'claim_evidence_reasoning', 'C', 6,
   '{"criterion":"C","task_type":"claim_evidence_reasoning","task_type_ui":"short_answer","difficulty_level":6,"title":"CER \u2022 claim evidence reasoning","prompt":"Make a scientific claim, provide two pieces of evidence from data, and explain the reasoning linking them.","estimated_duration_seconds":360,"simulation_url":null}',
   360),
  ('CER • claim evidence reasoning', 'claim_evidence_reasoning', 'C', 7,
   '{"criterion":"C","task_type":"claim_evidence_reasoning","task_type_ui":"short_answer","difficulty_level":7,"title":"CER \u2022 claim evidence reasoning","prompt":"Construct a full CER argument with a precise claim, multiple evidence points, and mechanistic reasoning.","estimated_duration_seconds":360,"simulation_url":null}',
   360),
  ('CER • claim evidence reasoning', 'claim_evidence_reasoning', 'C', 8,
   '{"criterion":"C","task_type":"claim_evidence_reasoning","task_type_ui":"short_answer","difficulty_level":8,"title":"CER \u2022 claim evidence reasoning","prompt":"Build a sophisticated CER argument, acknowledge counterevidence, and explain why your claim still holds.","estimated_duration_seconds":420,"simulation_url":null}',
   420);

-- error_analysis (C, difficulties 5 6 7 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('Error • error analysis', 'error_analysis', 'C', 5,
   '{"criterion":"C","task_type":"error_analysis","task_type_ui":"fill_blank","difficulty_level":5,"title":"Error \u2022 error analysis","prompt":"Inspect the shown method or data and identify one key error plus a correction.","estimated_duration_seconds":270,"simulation_url":null}',
   270),
  ('Error • error analysis', 'error_analysis', 'C', 6,
   '{"criterion":"C","task_type":"error_analysis","task_type_ui":"fill_blank","difficulty_level":6,"title":"Error \u2022 error analysis","prompt":"Identify two errors in the experimental method and explain the impact of each on the results.","estimated_duration_seconds":300,"simulation_url":null}',
   300),
  ('Error • error analysis', 'error_analysis', 'C', 7,
   '{"criterion":"C","task_type":"error_analysis","task_type_ui":"matching","difficulty_level":7,"title":"Error \u2022 error analysis","prompt":"Identify all errors in the dataset, classify them as random or systematic, and propose corrections.","estimated_duration_seconds":360,"simulation_url":null}',
   360),
  ('Error • error analysis', 'error_analysis', 'C', 8,
   '{"criterion":"C","task_type":"error_analysis","task_type_ui":"matching","difficulty_level":8,"title":"Error \u2022 error analysis","prompt":"Critically evaluate the experimental design for all sources of error, quantify their likely impact, and suggest improvements.","estimated_duration_seconds":420,"simulation_url":null}',
   420);

-- reflection_evaluation (C, difficulties 6 7 8)
insert into multimodal_tasks (title, task_type, criterion, difficulty_level, config, estimated_duration_seconds)
values
  ('Reflection • reflection evaluation', 'reflection_evaluation', 'C', 6,
   '{"criterion":"C","task_type":"reflection_evaluation","task_type_ui":"extended_response","difficulty_level":6,"title":"Reflection \u2022 reflection evaluation","prompt":"Evaluate reliability and limitations and suggest one improvement for this task.","estimated_duration_seconds":300,"simulation_url":null}',
   300),
  ('Reflection • reflection evaluation', 'reflection_evaluation', 'C', 7,
   '{"criterion":"C","task_type":"reflection_evaluation","task_type_ui":"extended_response","difficulty_level":7,"title":"Reflection \u2022 reflection evaluation","prompt":"Reflect on the quality of the data: validity, reliability, and two specific improvements with scientific reasoning.","estimated_duration_seconds":360,"simulation_url":null}',
   360),
  ('Reflection • reflection evaluation', 'reflection_evaluation', 'C', 8,
   '{"criterion":"C","task_type":"reflection_evaluation","task_type_ui":"extended_response","difficulty_level":8,"title":"Reflection \u2022 reflection evaluation","prompt":"Critically evaluate the investigation holistically: method, data quality, conclusion validity, and propose a redesign.","estimated_duration_seconds":420,"simulation_url":null}',
   420);

commit;
