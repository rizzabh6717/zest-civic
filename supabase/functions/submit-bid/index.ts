import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BidData {
  grievance_id: string;
  worker_id: string;
  bid_amount: number;
  proposal: string;
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

    const { grievance_id, worker_id, bid_amount, proposal }: BidData = await req.json();

    console.log('Submitting bid:', { grievance_id, worker_id, bid_amount });

    // Check if grievance exists and is available for bidding
    const { data: grievance, error: grievanceError } = await supabaseClient
      .from('grievances')
      .select('*')
      .eq('id', grievance_id)
      .single();

    if (grievanceError || !grievance) {
      throw new Error('Grievance not found');
    }

    if (!['classified', 'active'].includes(grievance.status)) {
      throw new Error('Grievance is not available for bidding');
    }

    // Insert worker bid
    const { data: bid, error: insertError } = await supabaseClient
      .from('worker_bids')
      .insert({
        grievance_id,
        worker_id,
        bid_amount,
        proposal,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting bid:', insertError);
      throw new Error(`Failed to submit bid: ${insertError.message}`);
    }

    console.log('Bid created:', bid);

    // Auto-assign logic (simplified - in real implementation this would be more complex)
    const { data: existingBids, error: bidsError } = await supabaseClient
      .from('worker_bids')
      .select('*')
      .eq('grievance_id', grievance_id)
      .eq('status', 'pending');

    if (bidsError) {
      console.error('Error fetching existing bids:', bidsError);
    } else if (existingBids && existingBids.length >= 1) {
      // Simple auto-assignment: lowest bid wins (in real implementation, consider reputation too)
      const winningBid = existingBids.reduce((lowest, current) => 
        current.bid_amount < lowest.bid_amount ? current : lowest
      );

      // Create task assignment
      const { data: assignment, error: assignmentError } = await supabaseClient
        .from('task_assignments')
        .insert({
          grievance_id,
          worker_id: winningBid.worker_id,
          bid_id: winningBid.id,
          escrow_amount: winningBid.bid_amount
        })
        .select()
        .single();

      if (!assignmentError) {
        // Update bid status and grievance status
        await supabaseClient
          .from('worker_bids')
          .update({ status: 'accepted' })
          .eq('id', winningBid.id);

        await supabaseClient
          .from('grievances')
          .update({ status: 'assigned' })
          .eq('id', grievance_id);

        console.log('Task assigned automatically:', assignment);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      bid,
      message: 'Bid submitted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in submit-bid function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to submit bid',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});