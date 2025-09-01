// src/domain/entities/FAQ.js
class FAQ {
  constructor({ id, question, answer, category, tags = [], createdAt = new Date(), updatedAt = new Date() }) {
    this.validateQuestion(question);
    this.validateAnswer(answer);
    
    this.id = id;
    this.question = this.sanitizeText(question);
    this.answer = this.sanitizeText(answer);
    this.category = this.sanitizeString(category);
    this.tags = tags.map(tag => this.sanitizeString(tag)).filter(Boolean);
    this.createdAt = new Date(createdAt);
    this.updatedAt = new Date(updatedAt);
  }

  validateQuestion(question) {
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      throw new Error('Question is required and must be a non-empty string');
    }
  }

  validateAnswer(answer) {
    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      throw new Error('Answer is required and must be a non-empty string');
    }
  }

  sanitizeString(str) {
    if (!str) return null;
    return str.toString().trim().substring(0, 100);
  }

  sanitizeText(text) {
    if (!text) return '';
    return text.toString().trim().substring(0, 2000);
  }

  update(updates) {
    if (updates.question) {
      this.validateQuestion(updates.question);
      this.question = this.sanitizeText(updates.question);
    }
    
    if (updates.answer) {
      this.validateAnswer(updates.answer);
      this.answer = this.sanitizeText(updates.answer);
    }
    
    if (updates.category) {
      this.category = this.sanitizeString(updates.category);
    }
    
    if (updates.tags) {
      this.tags = updates.tags.map(tag => this.sanitizeString(tag)).filter(Boolean);
    }
    
    this.updatedAt = new Date();
  }

  isRelevantTo(searchTerm) {
    const term = searchTerm.toLowerCase();
    return (
      this.question.toLowerCase().includes(term) ||
      this.answer.toLowerCase().includes(term) ||
      this.tags.some(tag => tag.toLowerCase().includes(term))
    );
  }
}

module.exports = { FAQ };