<?php
/**
 * AI extraction configuration — SAMPLE.
 *
 * Copy this file to  ai_config.php  on the SERVER ONLY and fill in the real
 * key. ai_config.php must never be committed to Git or shipped in a patch ZIP,
 * exactly like db.php.
 *
 * The key can also come from the OPENAI_API_KEY environment variable, which is
 * preferred where the host allows setting one; this file is the fallback for
 * shared hosting. ai_extract.php checks the environment first.
 */

if (!defined('AI_EXTRACT_ENTRY')) { http_response_code(403); exit; }

// Server-side only. Never appears in HTML, JS, or any browser request.
define('OPENAI_API_KEY', 'sk-REPLACE-ME');

// Official OpenAI API model IDs — verified against the current model docs.
// Do not use marketing nicknames here; only real API IDs work.
define('AI_EXTRACT_MODEL_PRIMARY', 'gpt-5.6-luna');  // vision + structured outputs
// Optional future fallback (not called in V2.1):
// define('AI_EXTRACT_MODEL_FALLBACK', 'gpt-5.4-mini');
