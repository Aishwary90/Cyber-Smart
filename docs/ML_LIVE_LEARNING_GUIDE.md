# ML Live Learning Guide

This project now supports a hybrid classifier:

- `rules` (existing JSON keyword logic)
- `ml+rules` (trained Naive Bayes model + rule fallback)

## What has been implemented

1. **Feedback API**
   - `POST /api/feedback`
   - `GET /api/feedback?limit=100`
   - Stores corrections and helpfulness signals in `case_feedback`.

2. **Model training pipeline**
   - `npm run ml:export` -> exports labeled feedback to `backend/data/training_samples.jsonl`
   - `npm run ml:train` -> trains model and writes:
     - `backend/models/current-model.json`
     - `backend/models/training-report.json`

3. **Live model usage**
   - Classifier loads model from `backend/models/current-model.json` automatically.
   - If model confidence is low, system falls back to rule engine.
   - API response includes:
     - `model_source`: `"ml+rules"` or `"rules"`
     - `model_version`: trained model version when available

## Required setup (you must do)

### 1) Create SQL table in Supabase

Run SQL from:

- `backend/sql/ml_feedback_schema.sql`

### 2) Environment variables

Add in `backend/.env`:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # needed for ml:export without user token
```

### 3) Provide labeled training data

Minimum input format (`jsonl`, one JSON per line):

```json
{"text":"my account hacked and password changed","label":"CT003"}
{"text":"clicked fake bank link and shared otp","label":"CT001"}
{"text":"voluntary dream11 loss no fraud","label":"NAC001"}
```

Store in:

- `backend/data/training_samples.jsonl`

### 4) Train model

```bash
cd backend
npm run ml:train
```

## Recommended operating process (weekly)

1. Export new labeled feedback:
   - `npm run ml:export`
2. Review/clean bad labels in `backend/data/training_samples.jsonl`
3. Retrain:
   - `npm run ml:train`
4. Restart backend to load new model.
5. Check model report in:
   - `backend/models/training-report.json`

## Label naming convention

- Crime labels: use existing IDs from `data/cyber_crime.json` (`CT001`, `CT003`, ...)
- Not-crime labels: use IDs from `data/not_a_crime.json` (`NAC001`, ...)

## Notes

- Do not train on unlabeled production data.
- Keep PII masked before training (`phone/email/account/OTP`).
- Use corrected labels (`corrected_class`) wherever available.
