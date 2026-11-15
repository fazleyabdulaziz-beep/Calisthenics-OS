
/**
 * =========================================================
 * CALISTHENICS OS
 * CLOUDFLARE WORKER API PROXY
 * =========================================================
 *
 * Environment variables:
 *
 * GAS_URL          = Google Apps Script /exec URL
 * BRIDGE_SECRET    = Secret shared with Apps Script
 * FRONTEND_ORIGIN  = https://fazleyabdulaziz-beep.github.io
 *
 * =========================================================
 */

const ALLOWED_FUNCTIONS = [
  'loginUser',
  'registerUser',
  'getSessionUser',
  'logoutUser',
  'changePassword',
  'api'
];

export default {

  async fetch(request, env) {

    const origin = request.headers.get('Origin') || '';

    const allowedOrigin = (
      env.FRONTEND_ORIGIN ||
      'https://fazleyabdulaziz-beep.github.io'
    ).replace(/\/+$/, '');

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
      'Cache-Control': 'no-store'
    };

    const jsonHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    };


    // -----------------------------------------------------
    // 1. HEALTH CHECK
    // -----------------------------------------------------

    if (request.method === 'GET') {

      return new Response(JSON.stringify({
        ok: true,
        app: 'CALISTHENICS OS',
        service: 'Cloudflare Worker',
        status: 'Worker online'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });

    }


    // -----------------------------------------------------
    // 2. CORS PREFLIGHT
    // -----------------------------------------------------

    if (request.method === 'OPTIONS') {

      if (origin !== allowedOrigin) {

        return new Response('Forbidden origin', {
          status: 403
        });

      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });

    }


    // -----------------------------------------------------
    // 3. METHOD VALIDATION
    // -----------------------------------------------------

    if (request.method !== 'POST') {

      return new Response(JSON.stringify({
        ok: false,
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: jsonHeaders
      });

    }


    // -----------------------------------------------------
    // 4. ORIGIN VALIDATION
    // -----------------------------------------------------

    if (origin !== allowedOrigin) {

      return new Response(JSON.stringify({
        ok: false,
        error: 'Forbidden origin'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });

    }


    // -----------------------------------------------------
    // 5. ENVIRONMENT VALIDATION
    // -----------------------------------------------------

    if (!env.GAS_URL) {

      console.error('Missing GAS_URL');

      return new Response(JSON.stringify({
        ok: false,
        error: 'Backend URL is not configured.'
      }), {
        status: 500,
        headers: jsonHeaders
      });

    }

    if (!env.BRIDGE_SECRET) {

      console.error('Missing BRIDGE_SECRET');

      return new Response(JSON.stringify({
        ok: false,
        error: 'Backend authentication is not configured.'
      }), {
        status: 500,
        headers: jsonHeaders
      });

    }


    // -----------------------------------------------------
    // 6. VALIDATE GAS URL
    // -----------------------------------------------------

    let gasUrl;

    try {

      gasUrl = new URL(env.GAS_URL);

      if (
        gasUrl.protocol !== 'https:' ||
        gasUrl.hostname !== 'script.google.com'
      ) {
        throw new Error('Invalid Apps Script URL');
      }

      if (!gasUrl.pathname.endsWith('/exec')) {
        throw new Error('Apps Script URL must end with /exec');
      }

    } catch (error) {

      console.error('Invalid GAS_URL:', error.message);

      return new Response(JSON.stringify({
        ok: false,
        error: 'Invalid Apps Script deployment URL.'
      }), {
        status: 500,
        headers: jsonHeaders
      });

    }


    // -----------------------------------------------------
    // 7. READ REQUEST
    // -----------------------------------------------------

    let payload;

    try {

      const raw = await request.text();

      if (raw.length > 30000) {

        return new Response(JSON.stringify({
          ok: false,
          error: 'Payload too large'
        }), {
          status: 413,
          headers: jsonHeaders
        });

      }

      payload = JSON.parse(raw);

    } catch (error) {

      return new Response(JSON.stringify({
        ok: false,
        error: 'Invalid JSON request.'
      }), {
        status: 400,
        headers: jsonHeaders
      });

    }


    // -----------------------------------------------------
    // 8. ACTION VALIDATION
    // -----------------------------------------------------

    if (
      !payload ||
      typeof payload.fn !== 'string' ||
      !ALLOWED_FUNCTIONS.includes(payload.fn)
    ) {

      return new Response(JSON.stringify({
        ok: false,
        error: 'Unsupported API action.'
      }), {
        status: 400,
        headers: jsonHeaders
      });

    }


    // -----------------------------------------------------
    // 9. FORWARD REQUEST TO GOOGLE APPS SCRIPT
    // -----------------------------------------------------

    try {

      const upstreamPayload = {
        ...payload,

        // Never trust a bridge secret supplied by browser.
        bridgeSecret: env.BRIDGE_SECRET

      };

      const upstream = await fetch(gasUrl.toString(), {

        method: 'POST',

        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'Accept': 'application/json'
        },

        body: JSON.stringify(upstreamPayload),

        redirect: 'follow'

      });


      const responseText = await upstream.text();


      // ---------------------------------------------------
      // 10. UPSTREAM RESPONSE VALIDATION
      // ---------------------------------------------------

      if (!upstream.ok) {

        console.error(
          'Apps Script HTTP error:',
          upstream.status,
          responseText.slice(0, 1000)
        );

        return new Response(JSON.stringify({
          ok: false,
          error: 'Apps Script returned an HTTP error.',
          upstream_status: upstream.status
        }), {
          status: 502,
          headers: jsonHeaders
        });

      }


      // Ensure the upstream response is valid JSON.
      let responseData;

      try {

        responseData = JSON.parse(responseText);

      } catch (error) {

        console.error(
          'Invalid Apps Script response:',
          responseText.slice(0, 1000)
        );

        return new Response(JSON.stringify({
          ok: false,
          error: 'Invalid response from Apps Script.'
        }), {
          status: 502,
          headers: jsonHeaders
        });

      }


      // ---------------------------------------------------
      // 11. RETURN RESPONSE TO FRONTEND
      // ---------------------------------------------------

      return new Response(
        JSON.stringify(responseData),
        {
          status: 200,
          headers: jsonHeaders
        }
      );


    } catch (error) {

      // Do not expose secrets or internal request details.
      console.error(
        'Worker upstream failure:',
        error.message
      );

      return new Response(JSON.stringify({
        ok: false,
        error: 'Unable to connect to backend.'
      }), {
        status: 502,
        headers: jsonHeaders
      });

    }

  }

};
