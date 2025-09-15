@echo off
REM deploy.bat - Script de despliegue para Windows

setlocal EnableDelayedExpansion

REM Configuración de colores
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

REM Variables
set STAGE=%1
set METHOD=%2
set REGION=%3

if "%STAGE%"=="" set STAGE=dev
if "%METHOD%"=="" set METHOD=serverless
if "%REGION%"=="" set REGION=us-east-1

echo %BLUE%[INFO]%NC% Starting Smithers v2 deployment...
echo %BLUE%[INFO]%NC% Stage: %STAGE%
echo %BLUE%[INFO]%NC% Method: %METHOD%
echo %BLUE%[INFO]%NC% Region: %REGION%

REM Verificar prerequisitos
echo %BLUE%[INFO]%NC% Checking prerequisites...

REM Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Node.js is not installed
    exit /b 1
)

REM AWS CLI
aws --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% AWS CLI is not installed
    exit /b 1
)

REM Verificar credenciales AWS
aws sts get-caller-identity >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% AWS credentials not configured
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Prerequisites check passed

REM Instalar dependencias
echo %BLUE%[INFO]%NC% Installing dependencies...

if "%METHOD%"=="serverless" (
    serverless --version >nul 2>&1
    if errorlevel 1 (
        echo %BLUE%[INFO]%NC% Installing Serverless Framework...
        npm install -g serverless
    )
) else if "%METHOD%"=="sam" (
    sam --version >nul 2>&1
    if errorlevel 1 (
        echo %RED%[ERROR]%NC% AWS SAM CLI is not installed. Please install it first.
        exit /b 1
    )
)

npm install
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Failed to install dependencies
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Dependencies installed

REM Validar variables de entorno
echo %BLUE%[INFO]%NC% Validating environment variables...

set ENV_FILE=.env.%STAGE%

if not exist "%ENV_FILE%" (
    echo %YELLOW%[WARNING]%NC% Environment file %ENV_FILE% not found
    echo %BLUE%[INFO]%NC% Creating template...
    
    (
        echo MONGODB_URI=mongodb+srv://your-connection-string
        echo OPENAI_API_KEY=sk-your-openai-key
        echo HOSTAWAY_ACCOUNT_ID=your-account-id
        echo HOSTAWAY_CLIENT_SECRET=your-client-secret
    ) > "%ENV_FILE%"
    
    echo %RED%[ERROR]%NC% Please update %ENV_FILE% with your actual values
    exit /b 1
)

REM Cargar variables de entorno
for /f "usebackq tokens=1,2 delims==" %%A in ("%ENV_FILE%") do (
    set "%%A=%%B"
)

REM Verificar variables requeridas
if "%MONGODB_URI%"=="" (
    echo %RED%[ERROR]%NC% MONGODB_URI is not set
    exit /b 1
)
if "%OPENAI_API_KEY%"=="" (
    echo %RED%[ERROR]%NC% OPENAI_API_KEY is not set
    exit /b 1
)
if "%HOSTAWAY_ACCOUNT_ID%"=="" (
    echo %RED%[ERROR]%NC% HOSTAWAY_ACCOUNT_ID is not set
    exit /b 1
)
if "%HOSTAWAY_CLIENT_SECRET%"=="" (
    echo %RED%[ERROR]%NC% HOSTAWAY_CLIENT_SECRET is not set
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Environment validation passed

REM Ejecutar despliegue
if "%METHOD%"=="serverless" (
    echo %BLUE%[INFO]%NC% Deploying with Serverless Framework...
    
    serverless deploy --stage %STAGE% --region %REGION% --verbose
    if errorlevel 1 (
        echo %RED%[ERROR]%NC% Serverless deployment failed
        exit /b 1
    )
    
    echo %GREEN%[SUCCESS]%NC% Serverless deployment completed!
    
) else if "%METHOD%"=="sam" (
    echo %BLUE%[INFO]%NC% Deploying with AWS SAM...
    
    sam build
    if errorlevel 1 (
        echo %RED%[ERROR]%NC% SAM build failed
        exit /b 1
    )
    
    sam deploy --stack-name smithers-v2-%STAGE% --capabilities CAPABILITY_IAM --region %REGION% --parameter-overrides Environment=%STAGE% MongoDBURI="%MONGODB_URI%" OpenAIAPIKey="%OPENAI_API_KEY%" HostawayAccountId="%HOSTAWAY_ACCOUNT_ID%" HostawayClientSecret="%HOSTAWAY_CLIENT_SECRET%"
    if errorlevel 1 (
        echo %RED%[ERROR]%NC% SAM deployment failed
        exit /b 1
    )
    
    echo %GREEN%[SUCCESS]%NC% SAM deployment completed!
    
) else (
    echo %RED%[ERROR]%NC% Unknown deployment method: %METHOD%
    echo %BLUE%[INFO]%NC% Available methods: serverless, sam
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Deployment completed successfully! 🎉

REM Mostrar información útil
echo.
echo %BLUE%[INFO]%NC% Useful endpoints:
echo %BLUE%[INFO]%NC% Health Check: /health
echo %BLUE%[INFO]%NC% Webhook: /webhooks/hostaway
echo %BLUE%[INFO]%NC% Admin API: /api/admin/stats

endlocal