
-- Explicitly restrict otp_codes: only admins can SELECT (service role bypasses RLS anyway)
CREATE POLICY "Only admins can read otp_codes"
ON public.otp_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Block any insert/update/delete from non-service-role
CREATE POLICY "Only admins can manage otp_codes"
ON public.otp_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
