-- Create grievances table
CREATE TABLE public.grievances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  citizen_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  location TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'classified', 'active', 'assigned', 'in_progress', 'completed', 'verified', 'disputed')),
  ai_classification JSONB,
  blockchain_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create worker_bids table
CREATE TABLE public.worker_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grievance_id UUID NOT NULL REFERENCES public.grievances(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  bid_amount DECIMAL(10,2) NOT NULL,
  proposal TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_assignments table
CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grievance_id UUID NOT NULL REFERENCES public.grievances(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  bid_id UUID NOT NULL REFERENCES public.worker_bids(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'disputed')),
  proof_image_url TEXT,
  escrow_amount DECIMAL(10,2)
);

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  user_type TEXT NOT NULL CHECK (user_type IN ('citizen', 'worker', 'dao')),
  display_name TEXT,
  wallet_address TEXT,
  reputation_score INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grievances
CREATE POLICY "Citizens can view all grievances" ON public.grievances FOR SELECT USING (true);
CREATE POLICY "Citizens can create their own grievances" ON public.grievances FOR INSERT WITH CHECK (true);
CREATE POLICY "Citizens can update their own grievances" ON public.grievances FOR UPDATE USING (citizen_id = auth.uid());

-- RLS Policies for worker_bids
CREATE POLICY "Workers can view bids on active grievances" ON public.worker_bids FOR SELECT USING (true);
CREATE POLICY "Workers can create bids" ON public.worker_bids FOR INSERT WITH CHECK (true);
CREATE POLICY "Workers can update their own bids" ON public.worker_bids FOR UPDATE USING (worker_id = auth.uid());

-- RLS Policies for task_assignments
CREATE POLICY "Anyone can view task assignments" ON public.task_assignments FOR SELECT USING (true);
CREATE POLICY "System can create assignments" ON public.task_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Workers can update assigned tasks" ON public.task_assignments FOR UPDATE USING (worker_id = auth.uid());

-- RLS Policies for profiles
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_grievances_updated_at
  BEFORE UPDATE ON public.grievances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();