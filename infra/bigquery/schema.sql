CREATE TABLE IF NOT EXISTS course_reviews_dataset.reviews_analytics (
  review_id STRING NOT NULL,
  course_id STRING NOT NULL,
  university_id STRING,
  university_name STRING,
  semester STRING,
  sentiment STRING,
  topic STRING,
  rating INT64,
  timestamp TIMESTAMP
);
