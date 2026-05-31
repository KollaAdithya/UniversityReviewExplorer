For a class project demo, the Low-Level Design (LLD) should show how the components, APIs, database tables, and ML services interact. Professors typically expect class diagrams, database schemas, API contracts, and sequence flows rather than production-grade microservice details.

# Campus Course Review Sentiment & Topic Explorer

## Low-Level Design (LLD)

---

# 1. Component Breakdown

```text
Frontend (React)
│
├── Search Page
├── Course Dashboard
├── Review Explorer
├── Topic Visualization
└── Sentiment Charts

        │ REST APIs
        ▼

Backend (FastAPI)
│
├── Course Controller
├── Review Controller
├── Analytics Controller
├── ML Service
├── BigQuery Service
└── Database Repository

        │
        ▼

Cloud SQL (PostgreSQL)
BigQuery
Vertex AI Gemini
```

---

# 2. Database Design

## COURSE

```sql
CREATE TABLE course (
    course_id UUID PRIMARY KEY,
    course_code VARCHAR(20),
    course_name VARCHAR(100),
    department VARCHAR(50),
    credits INT
);
```

Example

```text
CS501
Advanced Machine Learning
Computer Science
3
```

---

## PROFESSOR

```sql
CREATE TABLE professor (
    professor_id UUID PRIMARY KEY,
    professor_name VARCHAR(100),
    email VARCHAR(100)
);
```

---

## COURSE_OFFERING

A course can be taught multiple times.

```sql
CREATE TABLE course_offering (
    offering_id UUID PRIMARY KEY,
    course_id UUID,
    professor_id UUID,
    semester VARCHAR(20),
    year INT
);
```

Example

```text
CS501
Dr. Smith
Fall 2025
```

---

## REVIEW

```sql
CREATE TABLE review (
    review_id UUID PRIMARY KEY,
    offering_id UUID,
    review_text TEXT,
    rating INT,
    created_at TIMESTAMP
);
```

Example

```text
The projects were excellent
but workload was high.
```

---

## SENTIMENT_ANALYSIS

```sql
CREATE TABLE sentiment_analysis (
    review_id UUID PRIMARY KEY,
    sentiment VARCHAR(20),
    confidence_score DECIMAL(5,2)
);
```

Example

```text
positive
0.89
```

---

## TOPIC_ANALYSIS

```sql
CREATE TABLE topic_analysis (
    topic_id UUID PRIMARY KEY,
    review_id UUID,
    topic_name VARCHAR(50)
);
```

Example

```text
Workload
Projects
Exams
```

---

## COURSE_SUMMARY

Stores precomputed analytics.

```sql
CREATE TABLE course_summary (
    course_id UUID PRIMARY KEY,
    positive_reviews INT,
    neutral_reviews INT,
    negative_reviews INT,
    overall_score DECIMAL(5,2),
    generated_summary TEXT,
    updated_at TIMESTAMP
);
```

---

# 3. Backend Classes

## CourseService

```java
class CourseService {

    List<Course> getAllCourses();

    Course getCourseById(UUID courseId);

    CourseAnalytics getAnalytics(UUID courseId);
}
```

Responsibilities:

* Course lookup
* Dashboard aggregation

---

## ReviewService

```java
class ReviewService {

    void saveReview(Review review);

    List<Review> getReviews(UUID courseId);

    void deleteReview(UUID reviewId);
}
```

Responsibilities:

* CRUD operations

---

## SentimentService

```java
class SentimentService {

    SentimentResult analyze(String reviewText);

}
```

Output

```java
{
 sentiment: "positive",
 confidence: 0.92
}
```

Uses Vertex AI Gemini.

---

## TopicExtractionService

```java
class TopicExtractionService {

   List<String> extractTopics(String text);

}
```

Example output

```java
[
 "Projects",
 "Workload",
 "Exams"
]
```

---

## SummaryService

```java
class SummaryService {

   String generateSummary(
        List<Review> reviews
   );

}
```

Example

```text
Students appreciate practical
projects but note heavy
workloads near exams.
```

---

# 4. REST API Design

## Get Courses

```http
GET /api/v1/courses
```

Response

```json
[
  {
    "courseId":"1",
    "courseCode":"CS501",
    "courseName":"Advanced ML"
  }
]
```

---

## Get Course Dashboard

```http
GET /api/v1/courses/{courseId}/analytics
```

Response

```json
{
  "courseId":"1",
  "positive":72,
  "neutral":18,
  "negative":10,
  "topics":[
      "Projects",
      "Workload",
      "Exams"
  ],
  "summary":"Students appreciate..."
}
```

---

## Get Reviews

```http
GET /api/v1/courses/{courseId}/reviews
```

Response

```json
[
 {
   "reviewId":"1",
   "rating":5,
   "reviewText":"Great course"
 }
]
```

---

## Submit Review

```http
POST /api/v1/reviews
```

Request

```json
{
   "offeringId":"101",
   "rating":5,
   "reviewText":"Excellent course"
}
```

---

# 5. Sequence Diagram

## User Opens Dashboard

```text
Student
   |
   | Search CS501
   v

React UI
   |
   | GET /analytics
   v

FastAPI
   |
   | Query Summary
   v

Cloud SQL
   |
   | Return Metrics
   v

FastAPI
   |
   | Return JSON
   v

React Dashboard
```

---

## User Submits Review

```text
Student
   |
   | Submit Review
   v

Frontend
   |
   v

FastAPI
   |
   | Save Review
   v

Cloud SQL

   |
   | Trigger Analysis
   v

Vertex AI

   |
   | Sentiment
   | Topics
   v

FastAPI

   |
   | Update Summary
   v

Cloud SQL
```

---

# 6. BigQuery Analytics Layer

### Dataset

```text
course_reviews_dataset
```

### Table

```text
reviews_analytics
```

Fields

```text
review_id
course_id
semester
sentiment
topic
rating
timestamp
```

Used for:

* Sentiment trends
* Semester comparison
* Department comparison
* Professor comparison

---

# 7. Vertex AI Prompt Design

## Sentiment Prompt

```text
Analyze the sentiment of this
course review.

Return:
{
 sentiment,
 confidence
}
```

---

## Topic Prompt

```text
Extract the top 3 topics from
this course review.

Return only JSON.
```

---

## Summary Prompt

```text
Summarize the common opinions
from these reviews in less than
100 words.
```

---

# 8. GCP Deployment Diagram

```text
                    React UI
                (Cloud Storage)

                         │
                         ▼

                   API Gateway

                         │
                         ▼

               FastAPI (Cloud Run)

          ┌──────────┼───────────┐
          │          │           │
          ▼          ▼           ▼

      Cloud SQL   Vertex AI   BigQuery
      PostgreSQL   Gemini      Analytics

          │
          ▼

    Cloud Monitoring
```

# Demo-Ready Design Decisions

To keep implementation feasible in one week:

* React frontend
* FastAPI backend
* Cloud Run deployment
* Cloud SQL PostgreSQL
* Vertex AI Gemini for sentiment, topic extraction, and summaries
* BigQuery for analytics/reporting
* No Kafka, Kubernetes, Redis, or microservices

This gives you a clean academic architecture that demonstrates **Cloud Computing, Big Data, NLP, Machine Learning, REST APIs, and Database Design** without becoming too complex to build before the demo.
