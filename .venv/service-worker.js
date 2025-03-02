/**
 * Service Worker for Real-Time Earnings PWA
 * Handles caching and offline functionality
 */

const CACHE_NAME = 'earnings-app-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/manifest.json',
    '/images_icon-192x192.png',
    '/images_icon-512x512.png'
];

// Install event: Cache assets for offline use
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName !== CACHE_NAME;
                }).map(cacheName => {
                    console.log('Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event: Serve from cache, fall back to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone the request because it's a one-time use
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response because it's a one-time use
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                }).catch(() => {
                    // If both cache and network fail, serve offline fallback
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    
                    // Return nothing for non-navigation requests
                    return new Response('', {
                        status: 408,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
    );
});

// Handle background sync for offline data
self.addEventListener('sync', event => {
    if (event.tag === 'sync-settings') {
        event.waitUntil(syncSettings());
    }
});

// Background sync function to handle offline updates
async function syncSettings() {
    try {
        // This would typically involve sending data to a server
        // For a local-only app, we don't need to do anything here
        console.log('Background sync completed');
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Handle push notifications
self.addEventListener('push', event => {
    if (!event.data) {
        console.warn('Push event received but no data');
        return;
    }
    
    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = {
            title: 'Earnings Update',
            body: event.data.text()
        };
    }
    
    const options = {
        body: data.body || 'Your earnings have been updated',
        icon: '/images_icon-192x192.png',
        badge: '/images_icon-192x192.png',
        data: {
            url: data.url || '/'
        },
        vibrate: [100, 50, 100],
        timestamp: Date.now()
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Earnings Update', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    // Attempt to find an open window and navigate to the URL
    const urlToOpen = event.notification.data.url;
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(windowClients => {
            // Check if there is already a window with the URL open
            const matchingClient = windowClients.find(client => {
                return client.url === urlToOpen;
            });
            
            if (matchingClient) {
                // If so, focus it
                return matchingClient.focus();
            }
            
            // If not, open a new window
            return clients.openWindow(urlToOpen);
        })
    );
});

// Handle app updates
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});