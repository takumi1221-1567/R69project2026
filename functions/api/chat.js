// Cloudflare Pages Function - Dify API Proxy
export async function onRequestPost(context) {
    const { request, env } = context;

    const DIFY_API_KEY = env.DIFY_API_KEY;
    const DIFY_API_URL = env.DIFY_API_URL || 'https://api.dify.ai/v1';

    if (!DIFY_API_KEY) {
        return new Response(JSON.stringify({ error: 'DIFY_API_KEY not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const { query, conversation_id } = body;

        if (!query) {
            return new Response(JSON.stringify({ error: 'query is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const difyPayload = {
            inputs: {},
            query: query,
            response_mode: 'blocking',
            user: 'r69-user',
        };

        if (conversation_id) {
            difyPayload.conversation_id = conversation_id;
        }

        const difyResponse = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(difyPayload),
        });

        if (!difyResponse.ok) {
            const errorText = await difyResponse.text();
            console.error('Dify API error:', difyResponse.status, errorText);
            return new Response(JSON.stringify({ error: 'Dify API error', status: difyResponse.status }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const difyData = await difyResponse.json();

        return new Response(JSON.stringify({
            answer: difyData.answer,
            conversation_id: difyData.conversation_id,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
