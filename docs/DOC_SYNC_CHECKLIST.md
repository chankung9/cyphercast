# Doc Sync Checklist — cyphercast

Use this checklist whenever Codex HQ documentation under `projects/cyphercast/docs/` changes.  
Run through the steps in order and log the evidence in `audit/logs/<date>.md` with timestamps from `./scripts/current_time.sh`.

1. Pull the latest changes for both `codex-agent` and `cyphercast`.
2. Review the diff inside `projects/cyphercast/docs/` to confirm intended updates.
3. Execute `projects/cyphercast/scripts/doc_sync_diff.sh ../cyphercast` and inspect the output.
4. Apply the updates to the downstream repo (copy files or cherry-pick changes as needed).
5. Re-run the doc sync diff to ensure no differences remain.
6. Capture audit evidence (timestamp, summary, command output) and collect sign-offs if required by the pipeline stage.
