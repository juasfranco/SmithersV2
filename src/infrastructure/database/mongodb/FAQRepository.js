const mongoose = require('mongoose');
const { SecureLogger } = require('../../../shared/logger/SecureLogger');

/**
 * MongoDB Schema for FAQ
 */
const FAQSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        index: true
    },
    answer: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        index: true
    },
    listingMapId: {
        type: String,
        required: false,
        index: true
    },
    keywords: [{
        type: String,
        index: true
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { 
    timestamps: true,
    collection: 'Faqs' // Forzar nombre exacto de la colección
});

const FAQ = mongoose.model('FAQ', FAQSchema, 'Faqs'); // Especificar nombre exacto de la colección

/**
 * MongoDB implementation of FAQ Repository
 */
class MongoFAQRepository {
    constructor() {
        this.logger = new SecureLogger();
        this.model = FAQ;
    }

    async findAll() {
        try {
            return await this.model.find();
        } catch (error) {
            this.logger.error('Error finding FAQs', { error: error.message });
            throw error;
        }
    }

    async findByCategory(category) {
        try {
            return await this.model.find({ category });
        } catch (error) {
            this.logger.error('Error finding FAQs by category', { 
                error: error.message,
                category 
            });
            throw error;
        }
    }

    async findByListingMapId(listingMapId) {
        try {
            return await this.model.find({ listingMapId });
        } catch (error) {
            this.logger.error('Error finding FAQs by listingMapId', { 
                error: error.message,
                listingMapId 
            });
            throw error;
        }
    }

    async save(faq) {
        try {
            const faqModel = new this.model(faq);
            return await faqModel.save();
        } catch (error) {
            this.logger.error('Error saving FAQ', { 
                error: error.message,
                faq 
            });
            throw error;
        }
    }

    async update(id, faq) {
        try {
            return await this.model.findByIdAndUpdate(id, faq, { new: true });
        } catch (error) {
            this.logger.error('Error updating FAQ', { 
                error: error.message,
                id,
                faq 
            });
            throw error;
        }
    }

    async delete(id) {
        try {
            return await this.model.findByIdAndDelete(id);
        } catch (error) {
            this.logger.error('Error deleting FAQ', { 
                error: error.message,
                id 
            });
            throw error;
        }
    }

    async searchByKeywords(keywords) {
        try {
            return await this.model.find({
                keywords: { $in: keywords }
            });
        } catch (error) {
            this.logger.error('Error searching FAQs by keywords', { 
                error: error.message,
                keywords 
            });
            throw error;
        }
    }
}

module.exports = { MongoFAQRepository };
