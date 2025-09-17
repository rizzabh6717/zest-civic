import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface VerificationData {
  assignment_id: string;
  proof_image_url: string;
  citizen_approval: boolean;
  ai_verification?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { assignment_id, proof_image_url, citizen_approval }: VerificationData = await req.json();

    console.log('Verifying task:', { assignment_id, citizen_approval });

    // Fetch task assignment with related grievance
    const { data: assignment, error: fetchError } = await supabaseClient
      .from('task_assignments')
      .select(`
        *,
        grievances (*)
      `)
      .eq('id', assignment_id)
      .single();

    if (fetchError || !assignment) {
      throw new Error('Task assignment not found');
    }

    // AI verification using OpenAI Vision (simplified implementation)
    let ai_verification = true; // Default to true for demo purposes
    
    if (proof_image_url && openAIApiKey) {
      try {
        const verificationPrompt = `
        Analyze this image showing the completion of a community task.
        The task was: ${assignment.grievances.title} - ${assignment.grievances.description}
        
        Does this image show that the task has been completed satisfactorily? 
        Respond with only "APPROVED" or "REJECTED" followed by a brief reason.
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
                content: 'You are an AI assistant that verifies task completion from images.' 
              },
              { 
                role: 'user', 
                content: [
                  { type: 'text', text: verificationPrompt },
                  { type: 'image_url', image_url: { url: proof_image_url } }
                ]
              }
            ],
            max_tokens: 100
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const aiResponse = data.choices[0].message.content;
          ai_verification = aiResponse.includes('APPROVED');
          console.log('AI Verification result:', aiResponse);
        }
      } catch (aiError) {
        console.error('AI verification failed:', aiError);
        // Continue with manual verification only
      }
    }

    // Determine final verification status
    const verification_status = (citizen_approval && ai_verification) ? 'approved' : 'disputed';

    // Update task assignment
    const { error: updateError } = await supabaseClient
      .from('task_assignments')
      .update({
        completed_at: new Date().toISOString(),
        verification_status,
        proof_image_url
      })
      .eq('id', assignment_id);

    if (updateError) {
      throw new Error(`Failed to update task assignment: ${updateError.message}`);
    }

    // Update grievance status
    const grievanceStatus = verification_status === 'approved' ? 'completed' : 'disputed';
    const { error: grievanceUpdateError } = await supabaseClient
      .from('grievances')
      .update({ status: grievanceStatus })
      .eq('id', assignment.grievance_id);

    if (grievanceUpdateError) {
      console.error('Error updating grievance status:', grievanceUpdateError);
    }

    // If approved, simulate escrow release (in real implementation, this would trigger blockchain transaction)
    let escrow_released = false;
    if (verification_status === 'approved') {
      escrow_released = true;
      console.log(`Escrow of ${assignment.escrow_amount} released to worker ${assignment.worker_id}`);
    }

    return new Response(JSON.stringify({
      success: true,
      verification_status,
      ai_verification,
      citizen_approval,
      escrow_released,
      message: verification_status === 'approved' 
        ? 'Task verified and payment released' 
        : 'Task verification failed - dispute initiated'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in verify-task function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Verification failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});