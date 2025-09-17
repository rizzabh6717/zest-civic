import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { grievance_id } = await req.json();

    console.log('Classifying grievance:', grievance_id);

    // Fetch grievance details
    const { data: grievance, error: fetchError } = await supabaseClient
      .from('grievances')
      .select('*')
      .eq('id', grievance_id)
      .single();

    if (fetchError || !grievance) {
      throw new Error(`Failed to fetch grievance: ${fetchError?.message}`);
    }

    // Use OpenAI for classification
    const classificationPrompt = `
    Classify this community grievance into one of these categories: road, waste, sewage, lighting, water, public_safety, environment, other.
    Also assign a priority level: low, medium, high, urgent.
    
    Title: ${grievance.title}
    Description: ${grievance.description}
    Location: ${grievance.location}
    
    Respond in JSON format: {"category": "category_name", "priority": "priority_level", "reasoning": "brief explanation"}
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an AI assistant that classifies community grievances. Always respond with valid JSON.' 
          },
          { role: 'user', content: classificationPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    let classification;
    try {
      classification = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      // Fallback classification
      classification = {
        category: 'other',
        priority: 'medium',
        reasoning: 'Auto-classified due to parsing error'
      };
    }

    console.log('AI Classification result:', classification);

    // Update grievance with AI classification
    const { error: updateError } = await supabaseClient
      .from('grievances')
      .update({
        category: classification.category,
        priority: classification.priority,
        ai_classification: classification,
        status: 'classified'
      })
      .eq('id', grievance_id);

    if (updateError) {
      throw new Error(`Failed to update grievance: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      classification,
      message: 'Grievance classified successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in classify-grievance function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Classification failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});