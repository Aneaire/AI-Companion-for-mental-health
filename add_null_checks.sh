#!/bin/bash

# Add null checks to all route files that use gemini

files=(
  "server/routes/admin.ts"
  "server/routes/persona-cards.ts" 
  "server/routes/impersonate-chat.ts"
  "server/routes/impostor.ts"
  "server/routes/impersonateObserver.ts"
  "server/routes/generate-form.ts"
  "server/routes/enhance-background.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Find functions that use gemini.getGenerativeModel and add null checks
    sed -i '/const model = gemini\.getGenerativeModel(/i\
  if (!gemini) {\
    return c.json({ error: "AI service not configured" }, 503);\
  }\
' "$file"
  fi
done

# Special case for quality.ts analyzeMessageQuality function
sed -i '/const model = gemini\.getGenerativeModel({/i\
  if (!gemini) {\
    return {\
      overallProgress: 0,\
      emotionalStability: 0,\
      communicationClarity: 0,\
      problemSolving: 0,\
      recommendations: ["AI service not configured"],\
      crisisDetected: false,\
      summary: "Unable to analyze - AI service not available"\
    };\
  }\
' server/routes/quality.ts

echo "Null checks added to all route files"
