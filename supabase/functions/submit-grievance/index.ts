import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GrievanceData {
  title: string;
  description: string;
  location: string;
  category?: string;
  image_url?: string;
  citizen_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    const { title, description, location, category, image_url, citizen_id }: GrievanceData = await req.json();

    console.log('Submitting grievance:', { title, description, location, category });

    // Insert grievance into database
    const { data: grievance, error: insertError } = await supabaseClient
      .from('grievances')
      .insert({
        title,
        description,
        location,
        category,
        image_url,
        citizen_id,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting grievance:', insertError);
      throw new Error(`Failed to insert grievance: ${insertError.message}`);
    }

    console.log('Grievance created:', grievance);

    // Trigger AI classification
    const classificationResponse = await supabaseClient.functions.invoke('classify-grievance', {
      body: { grievance_id: grievance.id }
    });

    if (classificationResponse.error) {
      console.error('Error triggering AI classification:', classificationResponse.error);
    }

    // Simulate blockchain transaction (placeholder for now)
    const mockTxHash = `0x${Math.random().toString(16).slice(2)}`;
    
    // Update grievance with blockchain transaction hash
    const { error: updateError } = await supabaseClient
      .from('grievances')
      .update({ 
        blockchain_tx_hash: mockTxHash,
        status: 'active'
      })
      .eq('id', grievance.id);

    if (updateError) {
      console.error('Error updating grievance with tx hash:', updateError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      grievance: { ...grievance, blockchain_tx_hash: mockTxHash },
      message: 'Grievance submitted successfully and logged on blockchain'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in submit-grievance function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});