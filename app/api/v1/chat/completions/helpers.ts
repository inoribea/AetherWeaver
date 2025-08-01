import { NextRequest } from 'next/server';
import { validateApiKey, extractApiKey, isAuthEnabled, createAuthResponse } from '@/utils/auth';

export async function handleApiKeyValidation(req: NextRequest): Promise<Response | null> {
  if (isAuthEnabled() && process.env.ENABLE_API_AUTH !== 'false') {
    const apiKey = extractApiKey(req);
    const keyInfo = validateApiKey(apiKey);

    if (!keyInfo.isValid) {
      console.log('Invalid API key provided:', apiKey?.substring(0, 10) + '...');
      return createAuthResponse('Invalid API key provided');
    }

    console.log(`Valid API key used: ${keyInfo.isAdmin ? 'Admin' : 'User'} key`);
  } else {
    console.log('API Authentication is disabled.');
  }
  return null;
}