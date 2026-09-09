# AI Platform & Customer Business Intelligence

## 1. Inference Architecture

OpenClaw must never connect directly to Ollama.

```text
OpenClaw
   ↓
Inference Router
   ↓
Ollama
   ↓
Mac Studio / inference node
```

The Inference Router abstracts physical inference infrastructure and provides:

* model selection
* node selection
* health checking
* concurrency/capacity management
* request routing
* inference telemetry

Initial deployment:

```text
Mac Studio #1
└── Qwen 256B via Ollama
```

Architecture must support additional inference nodes without application changes.

---

## 2. Multi-Tenancy

`tenant_id` is mandatory throughout the platform.

Propagate:

```text
tenant_id
user_id
session_id
agent_id
request_id
```

from Cognito → API/Lambda → OpenClaw → Inference Router → telemetry/data lake.

**Never trust `tenant_id` supplied by the frontend.**

Tenant isolation must apply to:

* agents
* sessions
* memory
* tools
* telemetry
* business data
* analytics
* business insights

Include automated cross-tenant access tests.

---

## 3. Inference Node Registry

Maintain a registry containing:

```text
node_id
hostname
models
health
active_requests
queue_depth
max_concurrency
throughput
last_heartbeat
```

Routing priority:

1. Customer/model entitlement
2. Model availability
3. Node health
4. Node capacity
5. Request priority

---

## 4. Telemetry

Generate structured events for:

* agent tasks
* inference requests/completions
* inference failures
* tool calls/results
* human intervention
* customer feedback
* business events

Every event must include:

```text
tenant_id
request_id
session_id
agent_id
timestamp
event_type
```

Avoid storing prompts/responses by default. Collect operational metadata required for usage, cost, performance and optimisation.

---

## 5. Data Architecture

### Operational data

Use DynamoDB for:

* users
* agents
* configuration
* permissions
* sessions
* current task state
* application metadata

### Analytics

Use:

```text
S3
 ↓
Iceberg
 ↓
Glue Data Catalog
 ↓
Athena
```

Data lake structure:

```text
raw/
curated/
analytics/
```

Core analytical tables:

```text
agent_tasks
inference_events
tool_calls
model_usage
business_events
customer_feedback
business_insights
```

All tenant-owned records require `tenant_id`.

Use S3 lifecycle policies and compression to minimise cost.

Use Lake Formation for analytical access control.

---

# 6. Customer Business Intelligence Agent

Create a dedicated BI Agent for each tenant.

Purpose:

> Continuously analyse the customer's business data and identify actionable opportunities for improvement.

Analyse permitted data such as:

* customer interactions
* sales activity
* support activity
* workflow performance
* recurring requests
* operational events
* agent performance
* customer feedback
* AI usage

The BI Agent must be strictly tenant-scoped.

### Execution

Do **not** invoke the BI Agent on every interaction.

Initially run:

```text
Daily   → lightweight analysis
Weekly  → deeper analysis
Event   → significant business event
```

Prefer aggregated/curated data over repeatedly processing raw data.

Use local Qwen 256B where practical.

---

# 7. Business Insight Model

Store insights as structured records:

```text
tenant_id
insight_id
created_at
period_start
period_end
category
title
summary
evidence
metrics
confidence
severity
recommended_action
status
```

Example:

```text
Category: Customer Support

Title:
Delivery enquiries have increased

Summary:
Delivery-related enquiries increased 31% over the previous
30 days.

Evidence:
1,842 support interactions analysed.

Recommendation:
Create an automated delivery-status workflow.

Confidence:
High

Status:
New
```

Insights must always include supporting evidence/metrics where available.

---

# 8. Customer Portal

Add a **Business Insights** section to the customer portal.

Display:

* new insights
* historical insights
* category
* severity
* confidence
* supporting metrics
* evidence
* recommendations
* insight status

Customers should see **business intelligence**, not raw internal telemetry.

Example:

```text
Customer enquiries ↑ 31%

Delivery-related questions increased significantly
over the last 30 days.

Based on 1,842 interactions.

Recommended action:
Automate delivery-status enquiries.
```

---

# 9. Insight → Action

Business Insights should eventually become actionable.

```text
Insight
  ↓
Recommendation
  ↓
Customer approval
  ↓
Automation/workflow
  ↓
Measure outcome
  ↓
New data
  ↓
New insight
```

Initially require explicit customer approval before an insight can create or modify business automation.

---

# 10. Continuous Improvement

Track the outcome of recommendations.

Example:

```text
Data
 ↓
Insight
 ↓
Recommendation
 ↓
Customer approval
 ↓
Automation
 ↓
Outcome
 ↓
New data
```

Store outcome metrics against the original insight to determine whether recommendations actually improved the business.

---

# 11. Platform Intelligence

Maintain a separate internal analytics layer for platform-wide intelligence.

Use it to identify:

* common customer problems
* popular workflows
* agent failure patterns
* model performance
* automation opportunities
* infrastructure requirements
* potential new products

Never expose one customer's data to another customer.

Only use customer-derived information for cross-customer analysis where contract, privacy and data-protection requirements permit it.

---

# 12. Core Principles

### Shared AI, isolated customers

Do not run a separate Qwen instance per customer.

Use shared inference infrastructure with strict tenant isolation.

### Don't continuously retrain the base model

Prefer:

```text
Customer data
+
Retrieval
+
Structured business insights
+
Qwen
```

over per-customer fine-tuning.

### Business Intelligence is a product

The platform should evolve from:

> AI that performs work

to:

> AI that performs work and continuously identifies how the business can improve.

### Cost first

Initial analytics architecture should favour:

```text
DynamoDB
S3
Iceberg
Glue Catalog
Athena
Lambda
Local Qwen
```

Avoid always-on analytics infrastructure unless usage justifies it.

### Model/infrastructure abstraction

Customers should see:

```text
One AI platform
```

regardless of whether requests are running on:

```text
Mac Studio #1
Mac Studio #2
Mac Studio #3
...
```
