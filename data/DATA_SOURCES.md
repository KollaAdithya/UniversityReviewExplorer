# Public data sources (no synthetic reviews)

This app imports **real** student review text from freely available research datasets.

## Default local dataset (~1,000 reviews)

| Field | Value |
|-------|--------|
| **Name** | Rate My Professors sample (research export) |
| **Source** | [liumingchun/RateMyProfessor `RMP_sample_data.csv`](https://github.com/liumingchun/RateMyProfessor/blob/master/RMP_sample_data.csv) |
| **License** | Academic/research use; cite the repository and original RMP terms |
| **Coverage** | ~46 US colleges/universities, real professor names, course codes, comments, ratings |
| **Download** | `python scripts/download_public_data.py` |

## Large dataset (millions of reviews, optional)

| Field | Value |
|-------|--------|
| **Name** | Big Data Set from RateMyProfessor.com (He, 2020) |
| **Source** | [Mendeley Data — DOI 10.17632/fvtfjyvw7d.2](https://data.mendeley.com/datasets/fvtfjyvw7d/2) |
| **License** | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| **Size** | ~9.5M comment rows (download is large) |
| **Import** | After manual download, place CSV in `data/` and run: |

```bash
python scripts/import_public_data.py --file data/your_mendeley_export.csv --force --max-rows 50000
```

Column names should match the Mendeley export (e.g. `school_name`, `professor_name`, `comments`, `student_star`, `post_date`, `name_not_onlines` for course code).

## Other cited corpora (manual)

- **University of Waterloo course reviews** — [Kaggle CC0](https://www.kaggle.com/datasets/anthonysusevski/course-reviews-university-of-waterloo) (course-level, not professor-level; different schema).
- **EduRABSA** — [Zenodo](https://doi.org/10.5281/zenodo.16935017) (annotated research subset; CC BY-NC-SA).

## What we removed

`data/archive/rmp_subset.csv` was a **small synthetic** demo file (repeated templates across MIT/Stanford). It is no longer used for imports.
