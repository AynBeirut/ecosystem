-- Create user_backups table for encrypted cloud sync data
CREATE TABLE public.user_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_backups ENABLE ROW LEVEL SECURITY;

-- Users can only view their own backup
CREATE POLICY "Users can view their own backup" 
ON public.user_backups 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own backup
CREATE POLICY "Users can create their own backup" 
ON public.user_backups 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own backup
CREATE POLICY "Users can update their own backup" 
ON public.user_backups 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own backup
CREATE POLICY "Users can delete their own backup" 
ON public.user_backups 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_backups_updated_at
BEFORE UPDATE ON public.user_backups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();