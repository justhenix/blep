@echo off
echo ============================================
echo   BLEP KILL SWITCH - DISABLING VERTEX AI
echo ============================================
echo.
echo This will IMMEDIATELY disable the Vertex AI API
echo on project henixhacking. No more AI charges.
echo.
echo Press Ctrl+C to cancel, or...
pause

gcloud services disable aiplatform.googleapis.com --project=henixhacking --force
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   VERTEX AI DISABLED. YOUR VISA IS SAFE.
    echo ============================================
    echo.
    echo To re-enable later:
    echo   gcloud services enable aiplatform.googleapis.com --project=henixhacking
) else (
    echo.
    echo ERROR: Failed to disable. Try manually:
    echo   https://console.cloud.google.com/apis/api/aiplatform.googleapis.com/overview?project=henixhacking
)
echo.
pause
