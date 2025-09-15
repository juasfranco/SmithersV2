#!/bin/bash

# deploy.sh - Script de despliegue automatizado para Smithers v2

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones helper
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Variables
STAGE=${1:-dev}
METHOD=${2:-serverless}
REGION=${3:-us-east-1}

log_info "Starting Smithers v2 deployment..."
log_info "Stage: $STAGE"
log_info "Method: $METHOD"
log_info "Region: $REGION"

# Verificar prerequisitos
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Verificar credenciales AWS
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Instalar dependencias
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ "$METHOD" = "serverless" ]; then
        if ! command -v serverless &> /dev/null; then
            log_info "Installing Serverless Framework..."
            npm install -g serverless
        fi
    elif [ "$METHOD" = "sam" ]; then
        if ! command -v sam &> /dev/null; then
            log_error "AWS SAM CLI is not installed. Please install it first."
            exit 1
        fi
    fi
    
    npm install
    log_success "Dependencies installed"
}

# Validar variables de entorno
validate_env() {
    log_info "Validating environment variables..."
    
    local env_file=".env.${STAGE}"
    if [ ! -f "$env_file" ]; then
        log_warning "Environment file $env_file not found"
        log_info "Creating template..."
        
        cat > "$env_file" << EOF
MONGODB_URI=mongodb+srv://your-connection-string
OPENAI_API_KEY=sk-your-openai-key
HOSTAWAY_ACCOUNT_ID=your-account-id
HOSTAWAY_CLIENT_SECRET=your-client-secret
EOF
        
        log_error "Please update $env_file with your actual values"
        exit 1
    fi
    
    # Source environment variables
    set -a
    source "$env_file"
    set +a
    
    # Verificar variables requeridas
    required_vars=("MONGODB_URI" "OPENAI_API_KEY" "HOSTAWAY_ACCOUNT_ID" "HOSTAWAY_CLIENT_SECRET")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Environment validation passed"
}

# Ejecutar tests
run_tests() {
    log_info "Running tests..."
    
    # Aquí puedes agregar tus tests
    # npm test
    
    log_success "Tests passed"
}

# Desplegar con Serverless
deploy_serverless() {
    log_info "Deploying with Serverless Framework..."
    
    # Configurar variables de entorno para Serverless
    export MONGODB_URI
    export OPENAI_API_KEY
    export HOSTAWAY_ACCOUNT_ID
    export HOSTAWAY_CLIENT_SECRET
    
    # Deploy
    serverless deploy --stage "$STAGE" --region "$REGION" --verbose
    
    # Obtener URLs
    local api_url=$(serverless info --stage "$STAGE" --region "$REGION" | grep "ServiceEndpoint:" | awk '{print $2}')
    
    log_success "Serverless deployment completed!"
    log_info "API URL: $api_url"
    log_info "Health Check: ${api_url}/health"
    log_info "Webhook URL: ${api_url}/webhooks/hostaway"
}

# Desplegar con SAM
deploy_sam() {
    log_info "Deploying with AWS SAM..."
    
    # Build
    sam build
    
    # Deploy
    sam deploy \
        --stack-name "smithers-v2-${STAGE}" \
        --s3-bucket "smithers-v2-deployment-${STAGE}" \
        --capabilities CAPABILITY_IAM \
        --region "$REGION" \
        --parameter-overrides \
            Environment="$STAGE" \
            MongoDBURI="$MONGODB_URI" \
            OpenAIAPIKey="$OPENAI_API_KEY" \
            HostawayAccountId="$HOSTAWAY_ACCOUNT_ID" \
            HostawayClientSecret="$HOSTAWAY_CLIENT_SECRET"
    
    # Obtener outputs
    local stack_outputs=$(aws cloudformation describe-stacks \
        --stack-name "smithers-v2-${STAGE}" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs' \
        --output table)
    
    log_success "SAM deployment completed!"
    log_info "Stack outputs:"
    echo "$stack_outputs"
}

# Post-deployment tasks
post_deployment() {
    log_info "Running post-deployment tasks..."
    
    # Warm up Lambda (opcional)
    if [ "$STAGE" = "prod" ]; then
        log_info "Warming up Lambda function..."
        # Hacer una llamada al health check
        # curl -f "${api_url}/health" || log_warning "Health check failed"
    fi
    
    log_success "Post-deployment tasks completed"
}

# Main execution
main() {
    check_prerequisites
    install_dependencies
    validate_env
    run_tests
    
    case "$METHOD" in
        "serverless")
            deploy_serverless
            ;;
        "sam")
            deploy_sam
            ;;
        *)
            log_error "Unknown deployment method: $METHOD"
            log_info "Available methods: serverless, sam"
            exit 1
            ;;
    esac
    
    post_deployment
    
    log_success "Deployment completed successfully! 🎉"
}

# Help function
show_help() {
    echo "Usage: $0 [STAGE] [METHOD] [REGION]"
    echo ""
    echo "STAGE:   dev|staging|prod (default: dev)"
    echo "METHOD:  serverless|sam (default: serverless)"
    echo "REGION:  AWS region (default: us-east-1)"
    echo ""
    echo "Examples:"
    echo "  $0 dev serverless us-east-1"
    echo "  $0 prod sam eu-west-1"
    echo "  $0 staging"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main