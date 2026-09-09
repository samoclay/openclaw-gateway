-- Must contain :tenant_id. The job binds a validated tenant id only.
SELECT
  tenant_id,
  date_trunc('day', from_iso8601_timestamp(time)) AS metric_date,
  count(*) AS chats
FROM curated.inference_events
WHERE tenant_id = :tenant_id
GROUP BY 1, 2
