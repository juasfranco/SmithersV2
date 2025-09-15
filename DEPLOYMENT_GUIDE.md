# 🚀 Guía Completa de Despliegue AWS - Smithers v2

## 📋 Paso a Paso Detallado

### Paso 1: Preparación del Entorno Local

#### 1.1 Instalar AWS CLI
```powershell
# Descargar e instalar desde: https://aws.amazon.com/cli/
# O usar Chocolatey
choco install awscli
```

#### 1.2 Configurar Credenciales AWS
```powershell
aws configure
# AWS Access Key ID: [Tu Access Key]
# AWS Secret Access Key: [Tu Secret Key]
# Default region name: us-east-1
# Default output format: json
```

#### 1.3 Instalar Serverless Framework
```powershell
npm install -g serverless
```

#### 1.4 Instalar Dependencias del Proyecto
```powershell
cd c:\TWR\SmithersV2
npm install
```

### Paso 2: Configuración de Variables de Entorno

#### 2.1 Configurar MongoDB Atlas
1. Ir a [MongoDB Atlas](https://cloud.mongodb.com/)
2. Crear cluster o usar existente
3. Obtener connection string
4. Configurar Network Access (IP Whitelist: 0.0.0.0/0 para Lambda)

#### 2.2 Configurar OpenAI API
1. Ir a [OpenAI Platform](https://platform.openai.com/)
2. Generar API Key
3. Guardar la clave

#### 2.3 Configurar Variables de Entorno
Editar `.env.prod` con tus valores reales:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smithers?retryWrites=true&w=majority
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxx
HOSTAWAY_ACCOUNT_ID=12345
HOSTAWAY_CLIENT_SECRET=your-hostaway-secret
```

### Paso 3: Despliegue con Serverless Framework

#### 3.1 Despliegue de Desarrollo
```powershell
# Usar el script automatizado
.\deployment\deploy.bat dev serverless

# O manualmente
serverless deploy --stage dev --region us-east-1
```

#### 3.2 Despliegue de Producción
```powershell
# Usar el script automatizado
.\deployment\deploy.bat prod serverless

# O manualmente
serverless deploy --stage prod --region us-east-1
```

### Paso 4: Verificación del Despliegue

#### 4.1 Obtener URLs del API
```powershell
serverless info --stage prod
```

Ejemplo de output:
```
Service Information
service: smithers-v2
stage: prod
region: us-east-1
stack: smithers-v2-prod
resources: 12
api keys:
  None
endpoints:
  ANY - https://abc123def4.execute-api.us-east-1.amazonaws.com/prod/{proxy+}
  ANY - https://abc123def4.execute-api.us-east-1.amazonaws.com/prod/
functions:
  smithers: smithers-v2-prod
```

#### 4.2 Probar Endpoints
```powershell
# Health Check
curl https://abc123def4.execute-api.us-east-1.amazonaws.com/prod/health

# Webhook (con Postman o similar)
# POST https://abc123def4.execute-api.us-east-1.amazonaws.com/prod/webhooks/hostaway
```

### Paso 5: Configuración de Hostaway

#### 5.1 Configurar Webhook en Hostaway
1. Ir al panel de Hostaway
2. Navegar a Settings > Integrations > Webhooks
3. Agregar nuevo webhook:
   - **URL**: `https://tu-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod/webhooks/hostaway`
   - **Events**: Reservations, Messages, Listings
   - **Method**: POST

### Paso 6: Monitoreo y Logging

#### 6.1 Ver Logs en Tiempo Real
```powershell
serverless logs -f smithers -t --stage prod
```

#### 6.2 CloudWatch Dashboard
1. Ir a AWS Console > CloudWatch
2. Buscar logs: `/aws/lambda/smithers-v2-prod`
3. Configurar alarmas si es necesario

### Paso 7: Configuración de Dominio Personalizado (Opcional)

#### 7.1 Crear Certificado SSL
```powershell
# Usar AWS Certificate Manager
aws acm request-certificate \
  --domain-name api.tudominio.com \
  --validation-method DNS \
  --region us-east-1
```

#### 7.2 Configurar Dominio en API Gateway
```yaml
# Agregar a serverless.yml
custom:
  customDomain:
    domainName: api.tudominio.com
    certificateName: api.tudominio.com
    createRoute53Record: true
    endpointType: 'regional'
```

## 🛠️ Comandos Útiles

### Desarrollo Local
```powershell
# Ejecutar localmente
npm run dev

# Probar con Serverless Offline
npm run offline
```

### Gestión de Despliegues
```powershell
# Ver información del stack
serverless info --stage prod

# Ver logs
serverless logs -f smithers --stage prod -t

# Eliminar stack (¡CUIDADO!)
serverless remove --stage dev
```

### Debugging
```powershell
# Ver métricas
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average \
  --dimensions Name=FunctionName,Value=smithers-v2-prod
```

## 🚨 Troubleshooting

### Problemas Comunes

#### Error: "Unable to import module 'lambda'"
**Solución**: Verificar que todas las dependencias estén en `node_modules`
```powershell
rm -rf node_modules package-lock.json
npm install
```

#### Timeout en Lambda
**Solución**: Incrementar timeout en `serverless.yml`
```yaml
functions:
  smithers:
    timeout: 30  # segundos
```

#### Cold Start muy lento
**Solución**: Configurar Provisioned Concurrency
```yaml
functions:
  smithers:
    provisionedConcurrency: 2  # para prod
```

#### Error de conexión MongoDB
**Soluciones**:
1. Verificar connection string
2. Configurar IP whitelist en Atlas (0.0.0.0/0)
3. Verificar credenciales de base de datos

#### Error "Module not found"
**Solución**: Verificar que el módulo esté en dependencies (no devDependencies)

## 💰 Costos Estimados

### Lambda
- **Requests**: Primeras 1M gratis/mes, luego $0.20 por 1M
- **Duration**: Primeros 400,000 GB-seconds gratis/mes

### API Gateway
- **REST API**: $3.50 por millón de llamadas

### CloudWatch
- **Logs**: $0.50 por GB ingerido

**Estimación mensual**: $5-20 USD para aplicación pequeña-mediana

## 🔐 Mejores Prácticas de Seguridad

1. **Variables de Entorno**: Usar AWS Systems Manager Parameter Store
2. **API Keys**: Implementar autenticación
3. **CORS**: Configurar orígenes específicos
4. **Rate Limiting**: Ya implementado en el código
5. **Logs**: No loggear información sensible

## 🚀 Próximos Pasos

1. **CI/CD**: Configurar GitHub Actions (archivo ya incluido)
2. **Monitoring**: Configurar alarmas detalladas
3. **Performance**: Optimizar cold starts
4. **Backup**: Configurar respaldos de MongoDB
5. **DNS**: Configurar dominio personalizado