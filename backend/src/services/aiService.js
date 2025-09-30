import { GoogleGenerativeAI } from '@google/generative-ai';
import Grievance from '../models/Grievance.js';
import TaskAssignment from '../models/TaskAssignment.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// AI Classification Service for Grievances
export const classifyGrievance = async (grievanceId) => {
  try {
    console.log(`🤖 Starting AI classification for grievance: ${grievanceId}`);
    
    const grievance = await Grievance.findById(grievanceId);
    if (!grievance) {
      throw new Error('Grievance not found');
    }

    console.log(`📋 Grievance details:`, {
      title: grievance.title,
      category: grievance.category,
      status: grievance.status
    });

    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️ No Gemini API key found, using fallback classification');
      return await fallbackClassification(grievanceId);
    }

    const classificationPrompt = `You are an expert in Indian civic infrastructure and community grievances. Analyze this grievance with deep understanding of Indian urban/rural challenges.

GRIEVANCE DETAILS:
Title: ${grievance.title}
Description: ${grievance.description}
Location: ${grievance.location}
${grievance.image_url ? `Image Evidence: ${grievance.image_url}` : 'No visual evidence provided'}

CLASSIFICATION REQUIREMENTS:
Categories: road, waste, sewage, lighting, water, public_safety, environment, other
Priority Levels: low, medium, high, urgent

INDIAN CONTEXT FACTORS:
- Monsoon impact and seasonal considerations
- Population density effects
- Local government capacity
- Community impact in Indian cities/villages
- Safety risks specific to Indian infrastructure
- Public health concerns relevant to Indian conditions

PRIORITY GUIDELINES:
- URGENT: Immediate safety risk, water contamination, major road hazards, electrical dangers
- HIGH: Affects many people, health concerns, infrastructure damage, security issues  
- MEDIUM: Quality of life issues, moderate infrastructure problems, local inconveniences
- LOW: Minor aesthetic issues, non-urgent maintenance, individual complaints

Respond ONLY with valid JSON in this exact format:
{
  "category": "exact_category_name",
  "priority": "exact_priority_level",
  "reasoning": "concise explanation considering Indian context",
  "confidence": 0.85,
  "suggested_tags": ["relevant", "contextual", "tags"],
  "estimated_cost_range": "low|medium|high",
  "urgency_factors": ["specific_factor1", "specific_factor2"],
  "local_impact": "description of impact on local community",
  "seasonal_considerations": "monsoon/weather related factors if applicable"
}`;

    const result = await model.generateContent({
      contents: [{ 
        role: "user", 
        parts: [{ text: classificationPrompt }] 
      }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 500,
      }
    });

    const aiResponse = result.response.text();
    console.log('🤖 Raw AI Response:', aiResponse);

    let classification;
    try {
      // Clean the response in case there's extra text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
      
      classification = JSON.parse(jsonString);
      console.log('✅ Parsed AI classification:', classification);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError.message);
      console.error('Raw response was:', aiResponse);
      
      // Fallback classification
      classification = {
        category: 'other',
        priority: 'medium',
        reasoning: 'Auto-classified due to AI parsing error',
        confidence: 0.5,
        suggested_tags: ['unclassified'],
        estimated_cost_range: 'medium',
        urgency_factors: ['ai_parsing_failed']
      };
      console.log('🔄 Using fallback classification:', classification);
    }

    // Validate and sanitize classification
    const validCategories = ['road', 'waste', 'sewage', 'lighting', 'water', 'public_safety', 'environment', 'other'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    if (!validCategories.includes(classification.category)) {
      classification.category = 'other';
    }
    if (!validPriorities.includes(classification.priority)) {
      classification.priority = 'medium';
    }

    // Ensure confidence is between 0 and 1
    classification.confidence = Math.max(0, Math.min(1, classification.confidence || 0.5));
    classification.timestamp = new Date();

    // Update grievance with AI classification
    console.log('💾 Updating grievance in database...');
    
    const updateData = {
      category: classification.category,
      priority: classification.priority,
      ai_classification: classification,
      ai_tags: classification.suggested_tags || [],
      status: 'classified'
    };
    
    console.log('📝 Update data:', updateData);
    
    const updatedGrievance = await Grievance.findByIdAndUpdate(
      grievanceId, 
      updateData,
      { new: true } // Return the updated document
    );
    
    if (!updatedGrievance) {
      throw new Error('Failed to update grievance in database');
    }
    
    console.log(`✅ AI classification completed and saved for grievance ${grievanceId}`);
    console.log('📊 Final classification:', classification);
    
    return classification;

  } catch (error) {
    console.error('❌ AI classification failed:', error.message);
    console.error('🔧 Error details:', error);
    
    // Fallback: basic keyword-based classification
    console.log('🔄 Falling back to keyword-based classification...');
    const fallbackResult = await fallbackClassification(grievanceId);
    return fallbackResult;
  }
};

// AI Task Verification Service
export const verifyTaskCompletion = async (assignmentId, proofImageUrl, proofDescription = '') => {
  try {
    const assignment = await TaskAssignment.findById(assignmentId)
      .populate('grievance');
    
    if (!assignment) {
      throw new Error('Task assignment not found');
    }

    console.log(`Starting AI verification for assignment: ${assignmentId}`);

    const verificationPrompt = `You are an expert in Indian infrastructure quality assessment and civic work verification. Analyze this completion proof with understanding of Indian construction standards and community expectations.

ORIGINAL TASK DETAILS:
Title: ${assignment.grievance.title}
Description: ${assignment.grievance.description}
Location: ${assignment.grievance.location}
Category: ${assignment.grievance.category}
Priority: ${assignment.grievance.priority}

WORKER'S COMPLETION CLAIM: ${proofDescription}

VERIFICATION CRITERIA FOR INDIAN CONTEXT:
1. Work Quality Standards - appropriate for Indian civic infrastructure
2. Safety Compliance - meets local safety requirements
3. Durability Assessment - suitable for Indian weather conditions
4. Community Benefit - addresses the original community need
5. Completion Evidence - clear before/after comparison if available

QUALITY SCORING (1-10):
- 8-10: Excellent - exceeds expectations, durable, professional finish
- 6-7: Good - meets requirements, satisfactory quality
- 4-5: Acceptable - basic completion, may need minor improvements
- 1-3: Poor - substandard work, requires major improvements

Analyze the provided evidence and respond ONLY with valid JSON:
{
  "approved": true,
  "confidence": 0.85,
  "analysis": "detailed technical assessment of work quality and completion",
  "concerns": ["specific issues if any"],
  "quality_score": 8.5,
  "recommendation": "approve",
  "verification_factors": ["evidence_factor1", "quality_factor2"],
  "indian_standards_compliance": "assessment of local standards adherence",
  "durability_assessment": "expected lifespan and weather resistance",
  "community_benefit_achieved": "how well the solution addresses original issue"
}`;

    let result;
    if (proofImageUrl && proofImageUrl.startsWith('http')) {
      // Generate content with image
      result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: verificationPrompt },
            { 
              inlineData: {
                mimeType: "image/jpeg",
                data: await fetchImageAsBase64(proofImageUrl)
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 0.8,
          maxOutputTokens: 600,
        }
      });
    } else {
      // Text-only verification
      result = await model.generateContent({
        contents: [{ 
          role: "user", 
          parts: [{ text: verificationPrompt + "\n\nNote: No image provided - base verification on description only." }] 
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 600,
        }
      });
    }

    const aiResponse = result.response.text();
    let verification;

    try {
      verification = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI verification response:', aiResponse);
      verification = {
        approved: false,
        confidence: 0.3,
        analysis: 'Unable to process image verification',
        concerns: ['AI processing error'],
        quality_score: 5.0,
        recommendation: 'review',
        verification_factors: []
      };
    }

    // Ensure confidence and quality_score are within valid ranges
    verification.confidence = Math.max(0, Math.min(1, verification.confidence || 0.5));
    verification.quality_score = Math.max(0, Math.min(10, verification.quality_score || 5));
    verification.timestamp = new Date();

    // Update task assignment with AI verification
    await TaskAssignment.findByIdAndUpdate(assignmentId, {
      'verification.ai_verification': verification,
      'verification.proof_image_url': proofImageUrl,
      'verification.proof_description': proofDescription
    });

    console.log(`AI verification completed for assignment ${assignmentId}:`, verification);
    return verification;

  } catch (error) {
    console.error('AI verification failed:', error);
    
    // Return basic verification result
    return {
      approved: false,
      confidence: 0.1,
      analysis: 'AI verification service unavailable',
      concerns: ['Service error'],
      quality_score: 5.0,
      recommendation: 'review',
      verification_factors: [],
      timestamp: new Date()
    };
  }
};

// General Image Analysis Service
export const analyzeImage = async (imageUrl, context = '', analysisType = 'general') => {
  try {
    let prompt = '';
    
    switch (analysisType) {
      case 'grievance':
        prompt = `You are an expert in Indian civic infrastructure assessment. Analyze this image for community grievance classification.

Context: ${context}

ANALYZE FOR:
- Infrastructure type and condition
- Severity assessment for Indian urban/rural context
- Safety hazards relevant to Indian communities
- Resolution complexity considering local resources
- Category classification for Indian civic issues

Consider Indian-specific factors:
- Monsoon damage, drainage issues
- High population density impacts
- Local construction materials and methods
- Community safety in Indian context

Respond ONLY with valid JSON:
{
  "issue_type": "specific description of visible problem",
  "severity": "low|medium|high|critical",
  "safety_concerns": ["indian_context_concern1", "concern2"],
  "suggested_category": "road|waste|sewage|lighting|water|public_safety|environment|other",
  "visible_elements": ["element1", "element2"],
  "resolution_complexity": "simple|moderate|complex",
  "indian_context_factors": ["monsoon_impact", "density_issue", "etc"],
  "estimated_affected_population": "assessment of people impacted"
}`;
        break;
        
      case 'verification':
        prompt = `You are an expert in Indian infrastructure quality verification. Assess this completion proof image.

Context: ${context}

VERIFICATION CRITERIA:
- Evidence of work completion suitable for Indian conditions
- Quality standards appropriate for local infrastructure
- Durability for Indian weather (monsoon, heat, etc.)
- Safety compliance for Indian communities
- Long-term sustainability

Respond ONLY with valid JSON:
{
  "work_evident": true,
  "quality_assessment": "poor|fair|good|excellent",
  "completion_level": "incomplete|partial|complete",
  "visible_improvements": ["improvement1", "improvement2"],
  "remaining_issues": ["issue1", "issue2"],
  "indian_standards_met": true,
  "weather_durability": "assessment for monsoon/heat resistance",
  "safety_compliance": "evaluation of safety for Indian context"
}`;
        break;
        
      default:
        prompt = `Analyze this image with understanding of Indian civic infrastructure and community conditions.

Context: ${context}

Provide comprehensive analysis considering Indian urban/rural context.

Respond ONLY with valid JSON:
{
  "description": "detailed description of what you observe",
  "notable_features": ["feature1", "feature2"],
  "condition_assessment": "overall condition evaluation",
  "recommendations": ["actionable_recommendation1", "recommendation2"],
  "indian_context_relevance": "how this relates to Indian civic challenges"
}`;
    }

    let result;
    if (imageUrl && imageUrl.startsWith('http')) {
      result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { 
              inlineData: {
                mimeType: "image/jpeg",
                data: await fetchImageAsBase64(imageUrl)
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 500,
        }
      });
    } else {
      throw new Error('Valid image URL required for analysis');
    }

    const aiResponse = result.response.text();
    let analysis;

    try {
      analysis = JSON.parse(aiResponse);
      analysis.timestamp = new Date();
      analysis.confidence = 0.8; // Default confidence for image analysis
    } catch (parseError) {
      console.error('Failed to parse AI analysis response:', aiResponse);
      analysis = {
        error: 'Failed to analyze image',
        raw_response: aiResponse,
        timestamp: new Date(),
        confidence: 0.1
      };
    }

    return analysis;

  } catch (error) {
    console.error('Image analysis failed:', error);
    return {
      error: 'Image analysis service unavailable',
      message: error.message,
      timestamp: new Date(),
      confidence: 0.0
    };
  }
};

// Helper function to fetch image as base64 for Gemini Vision
const fetchImageAsBase64 = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return base64;
  } catch (error) {
    console.error('Failed to fetch image:', error);
    throw new Error('Unable to fetch image for analysis');
  }
};

// Enhanced fallback classification with Indian context
const fallbackClassification = async (grievanceId) => {
  try {
    const grievance = await Grievance.findById(grievanceId);
    if (!grievance) {
      throw new Error('Grievance not found');
    }

    const text = `${grievance.title} ${grievance.description} ${grievance.location}`.toLowerCase();
    
    // Enhanced keyword-based classification with Indian context
    let category = 'other';
    let priority = 'medium';
    const tags = [];
    const urgencyFactors = [];

    // Enhanced category detection with Indian terms and reasoning
    let reasoning = 'General civic issue requiring attention';
    
    if (text.includes('road') || text.includes('pothole') || text.includes('street') || 
        text.includes('रास्ता') || text.includes('सड़क') || text.includes('गड्ढा')) {
      category = 'road';
      tags.push('infrastructure', 'transport');
      reasoning = `Road infrastructure issue detected. Keywords found: ${text.match(/(road|pothole|street|रास्ता|सड़क|गड्ढा)/gi)?.join(', ')}. This affects vehicle movement and public safety, requiring immediate attention for community mobility.`;
    } else if (text.includes('waste') || text.includes('garbage') || text.includes('trash') ||
               text.includes('कचरा') || text.includes('गंदगी') || text.includes('safai')) {
      category = 'waste';
      tags.push('sanitation', 'health');
      reasoning = `Waste management issue identified. This impacts public health and sanitation standards in the community, requiring prompt cleaning and disposal services.`;
    } else if (text.includes('water') || text.includes('leak') || text.includes('pipe') ||
               text.includes('पानी') || text.includes('नल') || text.includes('टैंकी')) {
      category = 'water';
      tags.push('utilities', 'essential');
      reasoning = `Water supply or infrastructure problem detected. This is an essential utility affecting daily life and health of residents, requiring urgent repair services.`;
    } else if (text.includes('light') || text.includes('lamp') || text.includes('dark') ||
               text.includes('बत्ती') || text.includes('रोशनी') || text.includes('अंधेरा')) {
      category = 'lighting';
      tags.push('safety', 'security');
      reasoning = `Street lighting issue affecting public safety and security. Poor lighting increases crime risk and accidents, especially important for women's safety in Indian communities.`;
    } else if (text.includes('sewage') || text.includes('drain') || text.includes('sewer') ||
               text.includes('नाली') || text.includes('गंदा पानी')) {
      category = 'sewage';
      tags.push('sanitation', 'health');
      reasoning = `Sewage or drainage problem identified. This creates health hazards and can lead to waterborne diseases, especially critical during monsoon season in India.`;
    }

    // Enhanced priority detection
    if (text.includes('urgent') || text.includes('emergency') || text.includes('danger') ||
        text.includes('accident') || text.includes('तुरंत') || text.includes('जरूरी')) {
      priority = 'urgent';
      urgencyFactors.push('emergency_keywords');
    } else if (text.includes('important') || text.includes('safety') || text.includes('hazard') ||
               text.includes('health') || text.includes('सुरक्षा') || text.includes('खतरा')) {
      priority = 'high';
      urgencyFactors.push('safety_concern');
    } else if (text.includes('children') || text.includes('school') || text.includes('hospital') ||
               text.includes('बच्चे') || text.includes('स्कूल') || text.includes('अस्पताल')) {
      priority = 'high';
      urgencyFactors.push('public_facility');
    }

    // Add seasonal considerations for India
    const month = new Date().getMonth();
    if ((month >= 5 && month <= 9) && (category === 'sewage' || category === 'water')) {
      priority = priority === 'low' ? 'medium' : priority === 'medium' ? 'high' : priority;
      urgencyFactors.push('monsoon_season');
      tags.push('monsoon');
    }

    const classification = {
      category,
      priority,
      reasoning: reasoning + ` Priority set to ${priority} based on ${urgencyFactors.length > 0 ? urgencyFactors.join(', ') : 'standard assessment criteria'}.`,
      confidence: 0.7, // Higher confidence for better keyword matching
      suggested_tags: tags,
      estimated_cost_range: priority === 'urgent' ? 'high' : priority === 'high' ? 'medium-high' : 'medium',
      urgency_factors: urgencyFactors,
      local_impact: `Affects local community infrastructure and daily life of residents in the area`,
      seasonal_considerations: month >= 5 && month <= 9 ? 'Monsoon season increases urgency due to weather conditions and flooding risks' : 'Regular seasonal conditions apply',
      timestamp: new Date(),
      fallback: true
    };

    // Update grievance
    await Grievance.findByIdAndUpdate(grievanceId, {
      category: classification.category,
      priority: classification.priority,
      ai_classification: classification,
      ai_tags: classification.suggested_tags,
      status: 'classified'
    });

    console.log(`Enhanced fallback classification applied for grievance ${grievanceId}:`, classification);
    return classification;

  } catch (error) {
    console.error('Fallback classification failed:', error);
    throw error;
  }
};