# Despliegue de Smithers v2 en AWS

Este directorio contiene los scripts y configuraciones necesarios para desplegar Smithers v2 en AWS usando Lambda y API Gateway.

## Prerequisitos

1. **AWS CLI** configurado con credenciales apropiadas
2. **Node.js** 18.x o superior
3. **Serverless Framework** (opción 1) o **AWS SAM** (opción 2)

## Opción 1: Despliegue con Serverless Framework

### Instalación de dependencias
```bash
npm install -g serverless
npm install
```

### Configuración de variables de entorno
Crear archivo `.env.production`:
```
MONGODB_URI=mongodb+srv://your-connection-string
OPENAI_API_KEY=sk-your-openai-key
HOSTAWAY_ACCOUNT_ID=your-account-id
HOSTAWAY_CLIENT_SECRET=your-client-secret
```

### Comandos de despliegue
```bash
# Desarrollo
npm run deploy:dev

# Staging
npm run deploy:staging

# Producción
npm run deploy:prod

# Prueba local
npm run offline
```

## Opción 2: Despliegue con AWS SAM

### Instalación de SAM CLI
```bash
# Windows (con Chocolatey)
choco install aws-sam-cli

# O descargar desde: https://aws.amazon.com/serverless/sam/
```

### Configuración y despliegue
```bash
# Build
sam build

# Deploy con configuración guiada
sam deploy --guided

# Deploy con parámetros
sam deploy --parameter-overrides \
  MongoDBURI="mongodb+srv://your-connection-string" \
  OpenAIAPIKey="sk-your-openai-key" \
  HostawayAccountId="your-account-id" \
  HostawayClientSecret="your-client-secret"
```

## Configuración de Hostaway Webhook

Después del despliegue, configurar el webhook en Hostaway:
- URL: `https://your-api-id.execute-api.region.amazonaws.com/stage/webhooks/hostaway`
- Método: POST
- Eventos: Reservations, Messages

## Monitoreo

### CloudWatch Logs
- Grupo de logs: `/aws/lambda/smithers-v2-{stage}`
- Métricas personalizadas disponibles

### Alarmas configuradas
- Errores de Lambda
- Duración de ejecución
- Throttling

## URLs del API

### Endpoints principales
- **Health Check**: `GET /health`
- **Webhook Hostaway**: `POST /webhooks/hostaway`
- **Admin API**: `GET /api/admin/stats`
- **Debug**: `GET /api/debug/conversations`

## Troubleshooting

### Errores comunes
1. **Timeout de Lambda**: Aumentar timeout en configuración
2. **Memory Issues**: Incrementar memoria asignada
3. **Cold Start**: Usar provisioned concurrency para producción
4. **Environment Variables**: Verificar configuración en AWS Console

### Logs útiles
```bash
# Ver logs en tiempo real
serverless logs -f smithers -t

# Con SAM
sam logs -n smithers-v2-prod --stack-name smithers-v2 -t
```