import umami from '@umami/node';

const enabled = !!process.env.UMAMI_WEBSITE_ID;

umami.init({
    websiteId: process.env.UMAMI_WEBSITE_ID,
    hostUrl: 'https://cloud.umami.is',
});

export default async function trackEvent(event: string, data: Record<string, any>) {
    if (!enabled) return;
    try {
        await umami.track(event, data);
    } catch (error) {
        console.error("Error tracking event:", error);
    }
} 