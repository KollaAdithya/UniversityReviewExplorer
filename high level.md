If your professor expects a **Cloud + Big Data + ML** project, then using **Google Cloud Platform (GCP)** will make the architecture look much stronger and more industry-aligned.

# Campus Course Review Sentiment & Topic Explorer

## High-Level System Design (GCP Version)

```text
                   +-------------------+
                   |      Student      |
                   |  Web Browser      |
                   +---------+---------+
                             |
                             v
                   +-------------------+
                   | React Frontend    |
                   | (Cloud Storage)   |
                   +---------+---------+
                             |
                             v
                   +-------------------+
                   | API Gateway       |
                   +---------+---------+
                             |
                             v
                   +-------------------+
                   | FastAPI Backend   |
                   | Cloud Run         |
                   +---------+---------+
                             |
          +------------------+------------------+
          |                                     |
          v                                     v
+----------------------+          +----------------------+
| Cloud SQL            |          | Vertex AI            |
| PostgreSQL           |          | Sentiment & Topics   |
+----------------------+          +----------------------+
          |                                     |
          +------------------+------------------+
                             |
                             v
                   +-------------------+
                   | BigQuery          |
                   | Analytics Layer   |
                   +---------+---------+
                             |
                             v
                   +-------------------+
                   | Looker Studio     |
                   | Dashboards        |
                   +-------------------+
```

---

# GCP Services Mapping

| Component          | GCP Service                  |
| ------------------ | ---------------------------- |
| Frontend Hosting   | Cloud Storage Static Website |
| Backend API        | Cloud Run                    |
| Database           | Cloud SQL (PostgreSQL)       |
| Data Lake          | Cloud Storage                |
| Big Data Analytics | BigQuery                     |
| Machine Learning   | Vertex AI                    |
| Authentication     | Firebase Authentication      |
| Monitoring         | Cloud Monitoring             |
| API Management     | API Gateway                  |
| Visualization      | Looker Studio                |

---

# End-to-End Data Flow

## Step 1: Review Data Ingestion

Reviews can come from:

```text
CSV Upload
Professor Data
Sample Dataset
Manual Entry
```

Stored in:

```text
Google Cloud Storage
```

Bucket:

```text
course-review-data
```

---

## Step 2: ETL Pipeline

Use:

### Cloud Functions

or

### Dataflow (Apache Beam)

Pipeline:

```text
Raw Reviews
      ↓
Clean Text
      ↓
Remove Stopwords
      ↓
Store Clean Reviews
      ↓
BigQuery
```

---

## Step 3: Sentiment Analysis

When a review arrives:

```text
"This course was amazing but
the workload was heavy."
```

Vertex AI processes:

```json
{
  "sentiment": "positive",
  "score": 0.87
}
```

Results stored in:

```text
Cloud SQL
```

---

## Step 4: Topic Extraction

Vertex AI Gemini Model extracts:

Input:

```text
All reviews for CS501
```

Output:

```json
[
  "Projects",
  "Workload",
  "Exams",
  "Grading"
]
```

---

## Step 5: AI Summary Generation

Prompt:

```text
Summarize student opinions for CS501.
```

Gemini returns:

```text
Students appreciate the hands-on
projects and practical learning.
The most common criticism is
the heavy workload during
midterm periods.
```

---

# Big Data Component

Your instructor may ask:

> "Where is the Big Data aspect?"

Answer:

### BigQuery

Store all reviews in BigQuery.

Example:

```text
10 reviews today
100,000 reviews tomorrow
10 million reviews later
```

No architecture changes required.

BigQuery handles:

* Aggregations
* Historical analytics
* Trend detection

Example query:

```sql
SELECT
course_name,
AVG(sentiment_score)
FROM reviews
GROUP BY course_name;
```

---

# Frontend Dashboard

## Page 1: Course Search

```text
Search Course

CS101
CS201
DS501
```

---

## Page 2: Analytics Dashboard

```text
Course: CS501
```

### Sentiment Breakdown

```text
Positive 72%
Neutral 18%
Negative 10%
```

### Top Topics

```text
Projects
Assignments
Workload
Exams
```

### AI Summary

```text
Students enjoy the project-based
learning approach but mention
significant workload near exams.
```

### Review Explorer

```text
Filter:
Semester
Professor
Sentiment
```

---

# APIs

## Search Courses

```http
GET /courses
```

---

## Course Summary

```http
GET /courses/{id}/summary
```

Response:

```json
{
  "course":"CS501",
  "positive":72,
  "neutral":18,
  "negative":10,
  "topics":[
     "Projects",
     "Workload",
     "Exams"
  ]
}
```

---

# Deployment Architecture

```text
Frontend
   ↓
Cloud Storage

Backend
   ↓
Cloud Run

Database
   ↓
Cloud SQL

Analytics
   ↓
BigQuery

ML
   ↓
Vertex AI Gemini
```

---

# Demo Talking Points

During the presentation, emphasize:

### Cloud Computing

* Cloud Run auto-scaling backend
* Cloud SQL managed database
* Cloud Storage data lake

### Big Data

* BigQuery analytical warehouse
* Dataflow ETL pipeline
* Scalable to millions of reviews

### Machine Learning / AI

* Vertex AI sentiment analysis
* Gemini topic extraction
* AI-generated course summaries

### Business Value

Students can:

* Quickly evaluate courses
* Understand workload expectations
* Compare courses
* Make informed registration decisions

---

### Simplified MVP for Next Week

If time is limited, build:

```text
React
   ↓
Cloud Run FastAPI
   ↓
Cloud SQL
   ↓
Vertex AI Gemini
```

Use Gemini for:

* Sentiment Analysis
* Topic Extraction
* Summary Generation

This reduces development effort significantly while still showcasing **GCP + AI + Cloud + Analytics** in the demo.
