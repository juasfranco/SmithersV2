// services/hostawayService.js - SERVICIO CORREGIDO PARA AUTENTICACIÓN
const axios = require("axios");
require("dotenv").config();

class HostawayService {
  constructor() {
    this.baseURL = "https://api.hostaway.com/v1";
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  // 🔹 AUTENTICACIÓN: Obtener token de acceso
  async getAccessToken() {
    try {
      // Si ya tenemos un token válido, lo devolvemos
      if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }

      console.log("🔑 Obteniendo nuevo token de Hostaway...");
      console.log("🔍 Usando credenciales:", {
        client_id: process.env.HOSTAWAY_ACCOUNT_ID,
        client_secret: process.env.HOSTAWAY_CLIENT_SECRET ? "***" : "NO CONFIGURADO"
      });

      // 🔹 MÉTODO CORREGIDO: Usar string directo en lugar de URLSearchParams
      const formData = `grant_type=client_credentials&client_id=${process.env.HOSTAWAY_ACCOUNT_ID}&client_secret=${process.env.HOSTAWAY_CLIENT_SECRET}&scope=general`;

      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/accessTokens`,
        data: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        timeout: 60000 // 60 segundos timeout
      });

      this.accessToken = response.data.access_token;
      // El token dura 24 meses, pero lo renovamos cada 23 meses por seguridad
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - (30 * 24 * 60 * 60 * 1000);

      console.log("✅ Token de Hostaway obtenido exitosamente");
      console.log("🕐 Token expira en:", new Date(this.tokenExpiresAt).toISOString());
      
      return this.accessToken;

    } catch (error) {
      console.error("❌ Error detallado obteniendo token:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });

      // Verificar variables de entorno
      if (!process.env.HOSTAWAY_ACCOUNT_ID || !process.env.HOSTAWAY_CLIENT_SECRET) {
        throw new Error("Variables de entorno HOSTAWAY_ACCOUNT_ID y HOSTAWAY_CLIENT_SECRET son requeridas");
      }

      throw new Error(`Error obteniendo token: ${error.response?.data?.error || error.message}`);
    }
  }

  // 🔹 HELPER: Realizar peticiones autenticadas
  async apiRequest(method, endpoint, data = null) {
    try {
      const token = await this.getAccessToken();
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeout: 60000 // 60 segundos timeout
      };

      if (data) {
        config.data = data;
      }

      console.log(`🔍 API Request: ${method} ${endpoint}`);
      const response = await axios(config);
      return response.data;

    } catch (error) {
      // Si es error 403, el token probablemente expiró
      if (error.response?.status === 403) {
        console.log("🔄 Token expirado, renovando...");
        this.accessToken = null;
        this.tokenExpiresAt = null;
        
        // Reintentar una vez
        if (!arguments[3]) { // Evitar bucle infinito
          return this.apiRequest(method, endpoint, data, true);
        }
      }

      console.error(`❌ Error en API Hostaway ${method} ${endpoint}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  // 🔹 MÉTODO DE PRUEBA: Verificar conexión básica
  async testConnection() {
    try {
      console.log("🧪 Probando conexión básica a Hostaway...");
      
      // Intentar obtener token
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error("No se obtuvo token");
      }

      // Probar una llamada API simple (obtener perfil/account info)
      try {
        const response = await this.apiRequest('GET', '/me');
        console.log("✅ Conexión exitosa. Info de cuenta:", {
          accountId: response.result?.id,
          name: response.result?.name,
          email: response.result?.email
        });
        return true;
      } catch (apiError) {
        // Si falla /me, probar con listings (algunos accounts no tienen acceso a /me)
        try {
          const listingsResponse = await this.apiRequest('GET', '/listings?limit=1');
          console.log("✅ Conexión exitosa. Listings accesibles:", listingsResponse.count || 0);
          return true;
        } catch (listingsError) {
          console.error("❌ Error en llamada de prueba:", listingsError.message);
          return false;
        }
      }

    } catch (error) {
      console.error("❌ Error en test de conexión:", error.message);
      return false;
    }
  }

  // 🔹 OBTENER DATOS DE RESERVA
  async getReservationById(reservationId) {
    try {
      console.log(`🏠 Obteniendo reserva ${reservationId} desde Hostaway...`);
      
      const response = await this.apiRequest('GET', `/reservations/${reservationId}?includeResources=1`);
      
      if (response.status === 'success') {
        const reservation = response.result;
        console.log("✅ Reserva obtenida:", {
          id: reservation.id,
          listingMapId: reservation.listingMapId,
          guestName: reservation.guestName,
          status: reservation.status
        });
        
        return reservation;
      }
      
      return null;
    } catch (error) {
      console.error("❌ Error obteniendo reserva:", error.response?.data || error.message);
      return null;
    }
  }

  // 🔹 OBTENER CONVERSACIÓN COMPLETA
  async getConversationById(conversationId) {
    try {
      console.log(`💬 Obteniendo conversación ${conversationId} desde Hostaway...`);
      
      const response = await this.apiRequest('GET', `/conversations/${conversationId}?includeResources=1`);
      
      if (response.status === 'success') {
        const conversation = response.result;
        console.log("✅ Conversación obtenida:", {
          id: conversation.id,
          reservationId: conversation.reservationId,
          totalMessages: conversation.conversationMessages?.length || 0
        });
        
        return conversation;
      }
      
      return null;
    } catch (error) {
      console.error("❌ Error obteniendo conversación:", error.response?.data || error.message);
      return null;
    }
  }

  // 🔹 OBTENER MENSAJES DE UNA CONVERSACIÓN
  async getConversationMessages(conversationId, limit = 20) {
    try {
      console.log(`📨 Obteniendo mensajes de conversación ${conversationId}...`);
      
      const response = await this.apiRequest('GET', 
        `/conversations/${conversationId}/messages?limit=${limit}&sortOrder=createdAtDesc`
      );
      
      if (response.status === 'success') {
        const messages = response.result || [];
        console.log(`✅ ${messages.length} mensajes obtenidos`);
        return messages;
      }
      
      return [];
    } catch (error) {
      console.error("❌ Error obteniendo mensajes:", error.response?.data || error.message);
      return [];
    }
  }

  // 🔹 OBTENER LISTING POR ID
  async getListingById(listingId) {
    try {
      console.log(`🏨 Obteniendo listing ${listingId} desde Hostaway...`);
      
      const response = await this.apiRequest('GET', `/listings/${listingId}?includeResources=1`);
      
      if (response.status === 'success') {
        const listing = response.result;
        console.log("✅ Listing obtenido:", {
          id: listing.id,
          name: listing.name,
          address: listing.address
        });
        
        return listing;
      }
      
      return null;
    } catch (error) {
      console.error("❌ Error obteniendo listing:", error.response?.data || error.message);
      return null;
    }
  }

  // 🔹 ENVIAR MENSAJE AL HUÉSPED
  async sendMessageToGuest(reservationId, message) {
    try {
      console.log(`📤 Enviando mensaje a reserva ${reservationId}...`);
      
      const response = await this.apiRequest('POST', '/messages', {
        reservationId: parseInt(reservationId),
        message: message,
        type: 'inquiry' // o 'booking' dependiendo del contexto
      });

      if (response.status === 'success') {
        console.log("✅ Mensaje enviado exitosamente");
        return response.result;
      }

      return null;
    } catch (error) {
      console.error("❌ Error enviando mensaje:", error.response?.data || error.message);
      return null;
    }
  }

  // 🔹 OBTENER DATOS COMPLETOS PARA EL AGENTE
  async getCompleteContextForAgent(reservationId, conversationId = null) {
    try {
      console.log(`🔍 Obteniendo contexto completo para reserva ${reservationId}...`);
      
      // Obtener reserva
      const reservation = await this.getReservationById(reservationId);
      if (!reservation) {
        throw new Error("No se pudo obtener la reserva");
      }

      // Obtener listing
      const listing = await this.getListingById(reservation.listingMapId);

      // Obtener conversación si se proporciona ID
      let conversation = null;
      let messages = [];
      
      if (conversationId) {
        conversation = await this.getConversationById(conversationId);
        messages = await this.getConversationMessages(conversationId, 10);
      } else if (reservation.conversationId) {
        // Si la reserva tiene una conversación asociada
        conversation = await this.getConversationById(reservation.conversationId);
        messages = await this.getConversationMessages(reservation.conversationId, 10);
      }

      const context = {
        reservation: {
          id: reservation.id,
          listingMapId: reservation.listingMapId,
          guestName: reservation.guestName,
          guestEmail: reservation.guestEmail,
          guestPhone: reservation.guestPhone,
          checkInDate: reservation.arrivalDate,
          checkOutDate: reservation.departureDate,
          numberOfGuests: reservation.numberOfGuests,
          status: reservation.status,
          totalPrice: reservation.totalPrice,
          currency: reservation.currencyCode,
          source: reservation.channelName
        },
        listing: listing ? {
          id: listing.id,
          name: listing.name,
          address: listing.address,
          checkInTime: listing.checkInTimeStart,
          checkOutTime: listing.checkOutTime,
          wifiUsername: listing.wifiUsername,
          wifiPassword: listing.wifiPassword,
          doorCode: listing.doorSecurityCode,
          specialInstructions: listing.specialInstruction,
          houseRules: listing.houseRules,
          contactName: listing.contactName,
          contactPhone: listing.contactPhone1,
          contactEmail: listing.contactEmail
        } : null,
        conversation: {
          id: conversation?.id || null,
          recentMessages: messages.map(msg => ({
            id: msg.id,
            type: msg.type,
            message: msg.message,
            sentAt: msg.insertedOn,
            isFromGuest: msg.type === 'inquiry'
          }))
        }
      };

      console.log("✅ Contexto completo obtenido:", {
        reservationId: context.reservation.id,
        listingName: context.listing?.name || 'N/A',
        messagesCount: context.conversation.recentMessages.length
      });

      return context;

    } catch (error) {
      console.error("❌ Error obteniendo contexto completo:", error.message);
      throw error;
    }
  }

  // 🔹 BUSCAR RESERVAS POR CRITERIOS
  async searchReservations(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.guestEmail) params.append('guestEmail', filters.guestEmail);
      if (filters.guestPhone) params.append('guestPhone', filters.guestPhone);
      if (filters.listingMapId) params.append('listingMapId', filters.listingMapId);
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);
      
      const response = await this.apiRequest('GET', `/reservations?${params.toString()}`);
      
      if (response.status === 'success') {
        return response.result || [];
      }
      
      return [];
    } catch (error) {
      console.error("❌ Error buscando reservas:", error.response?.data || error.message);
      return [];
    }
  }
}

// Instancia singleton
const hostawayService = new HostawayService();

// 🔹 FUNCIONES EXPORTADAS (mantener compatibilidad con código existente)
async function sendMessageToGuest(reservationId, message) {
  return hostawayService.sendMessageToGuest(reservationId, message);
}

async function getReservationData(reservationId) {
  return hostawayService.getReservationById(reservationId);
}

async function getConversationData(conversationId) {
  return hostawayService.getConversationById(conversationId);
}

async function getCompleteContext(reservationId, conversationId = null) {
  return hostawayService.getCompleteContextForAgent(reservationId, conversationId);
}

module.exports = { 
  sendMessageToGuest,
  getReservationData,
  getConversationData,
  getCompleteContext,
  hostawayService 
};