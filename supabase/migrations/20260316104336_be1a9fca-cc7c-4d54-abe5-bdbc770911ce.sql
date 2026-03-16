-- Make payment-proofs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Anyone can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view payment proofs" ON storage.objects;

-- Allow admins to view payment proofs (for signed URL generation)
CREATE POLICY "Admins can view payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow service role uploads only (via edge function)
-- No direct client upload policy needed since edge function uses service role