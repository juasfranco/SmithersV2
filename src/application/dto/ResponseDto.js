// src/application/dto/ResponseDto.js
class ResponseDto {
  constructor({
    response,
    source,
    detectedField = null,
    processingTime = 0,
    confidence = 0.5,
    timestamp = new Date()
  }) {
    this.response = response;
    this.source = source;
    this.detectedField = detectedField;
    this.processingTime = processingTime;
    this.confidence = confidence;
    this.timestamp = timestamp;
  }

  toJSON() {
    return {
      response: this.response,
      source: this.source,
      detectedField: this.detectedField,
      processingTime: this.processingTime,
      confidence: this.confidence,
      timestamp: this.timestamp
    };
  }
}

module.exports = { ResponseDto };