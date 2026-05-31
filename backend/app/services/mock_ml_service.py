import re
from collections import Counter

from app.schemas import SentimentResult

POSITIVE_WORDS = {
    "amazing", "excellent", "great", "good", "love", "helpful", "practical",
    "engaging", "clear", "awesome", "fantastic", "enjoy", "best", "recommend",
}
NEGATIVE_WORDS = {
    "bad", "terrible", "awful", "heavy", "hard", "difficult", "boring",
    "confusing", "hate", "worst", "stressful", "overwhelming", "unfair",
}

TOPIC_KEYWORDS = {
    "Projects": {"project", "projects", "hands-on", "lab", "assignment"},
    "Workload": {"workload", "heavy", "time", "hours", "demanding"},
    "Exams": {"exam", "exams", "midterm", "final", "test", "quiz"},
    "Grading": {"grade", "grading", "rubric", "points", "curve"},
    "Lectures": {"lecture", "lectures", "professor", "teaching", "explains"},
    "Assignments": {"assignment", "assignments", "homework", "problem set"},
}


def analyze_sentiment(text: str) -> SentimentResult:
    words = set(re.findall(r"[a-zA-Z']+", text.lower()))
    positive_hits = len(words & POSITIVE_WORDS)
    negative_hits = len(words & NEGATIVE_WORDS)

    if positive_hits > negative_hits:
        sentiment = "positive"
        confidence = min(0.95, 0.55 + positive_hits * 0.1)
    elif negative_hits > positive_hits:
        sentiment = "negative"
        confidence = min(0.95, 0.55 + negative_hits * 0.1)
    else:
        sentiment = "neutral"
        confidence = 0.6

    return SentimentResult(sentiment=sentiment, confidence=round(confidence, 2))


def extract_topics(text: str, limit: int = 3) -> list[str]:
    words = set(re.findall(r"[a-zA-Z']+", text.lower()))
    scores: list[tuple[str, int]] = []

    for topic, keywords in TOPIC_KEYWORDS.items():
        score = len(words & keywords)
        if score > 0:
            scores.append((topic, score))

    scores.sort(key=lambda item: item[1], reverse=True)
    if not scores:
        return ["General"]

    return [topic for topic, _ in scores[:limit]]


def generate_summary(review_texts: list[str], positive: int, neutral: int, negative: int, top_topics: list[str]) -> str:
    total = positive + neutral + negative
    if total == 0:
        return "No reviews yet for this course."

    topics_text = ", ".join(top_topics[:4]) if top_topics else "various aspects"
    dominant = max([("positive", positive), ("neutral", neutral), ("negative", negative)], key=lambda x: x[1])[0]
    positive_pct = round(positive * 100 / total)
    neutral_pct = round(neutral * 100 / total)
    negative_pct = max(0, 100 - positive_pct - neutral_pct)

    if dominant == "positive":
        tone = "Students generally speak positively about this course"
    elif dominant == "negative":
        tone = "Students frequently mention concerns about this course"
    else:
        tone = "Student opinions are mixed for this course"

    return (
        f"{tone}. Common discussion themes include {topics_text}. "
        f"Based on {total} reviews, sentiment is roughly {positive_pct}% positive, "
        f"{neutral_pct}% neutral, and {negative_pct}% negative."
    )
