// Location service for handling geocoding, distance calculations, and location-based matching

export interface Location {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface LocationWithDistance extends Location {
  distance: number; // in kilometers
}

export class LocationService {
  // Calculate distance between two points using Haversine formula
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Geocode address to coordinates using Google Geocoding API (mock implementation)
  static async geocodeAddress(address: string): Promise<Location> {
    // In production, you would use Google Geocoding API
    // For now, we'll use mock coordinates based on common cities
    
    const mockLocations: { [key: string]: Location } = {
      'new york': { lat: 40.7128, lng: -74.0060, address: 'New York, NY', city: 'New York', state: 'NY', country: 'USA' },
      'los angeles': { lat: 34.0522, lng: -118.2437, address: 'Los Angeles, CA', city: 'Los Angeles', state: 'CA', country: 'USA' },
      'chicago': { lat: 41.8781, lng: -87.6298, address: 'Chicago, IL', city: 'Chicago', state: 'IL', country: 'USA' },
      'houston': { lat: 29.7604, lng: -95.3698, address: 'Houston, TX', city: 'Houston', state: 'TX', country: 'USA' },
      'phoenix': { lat: 33.4484, lng: -112.0740, address: 'Phoenix, AZ', city: 'Phoenix', state: 'AZ', country: 'USA' },
      'philadelphia': { lat: 39.9526, lng: -75.1652, address: 'Philadelphia, PA', city: 'Philadelphia', state: 'PA', country: 'USA' },
      'san antonio': { lat: 29.4241, lng: -98.4936, address: 'San Antonio, TX', city: 'San Antonio', state: 'TX', country: 'USA' },
      'san diego': { lat: 32.7157, lng: -117.1611, address: 'San Diego, CA', city: 'San Diego', state: 'CA', country: 'USA' },
      'dallas': { lat: 32.7767, lng: -96.7970, address: 'Dallas, TX', city: 'Dallas', state: 'TX', country: 'USA' },
      'san jose': { lat: 37.3382, lng: -121.8863, address: 'San Jose, CA', city: 'San Jose', state: 'CA', country: 'USA' }
    };

    const lowerAddress = address.toLowerCase();
    
    // Try to find a match in mock locations
    for (const [city, location] of Object.entries(mockLocations)) {
      if (lowerAddress.includes(city)) {
        return location;
      }
    }

    // If no match found, generate random coordinates within reasonable bounds
    const randomLat = 25 + Math.random() * 25; // Between 25-50 degrees (US latitudes)
    const randomLng = -125 + Math.random() * 60; // Between -125 to -65 degrees (US longitudes)
    
    return {
      lat: randomLat,
      lng: randomLng,
      address: address,
      country: 'USA'
    };
  }

  // Find nearby locations within a specified radius
  static findNearbyLocations(
    centerLocation: Location,
    locations: Location[],
    maxDistance: number = 10 // Default 10km radius
  ): LocationWithDistance[] {
    return locations
      .map(location => ({
        ...location,
        distance: this.calculateDistance(
          centerLocation.lat,
          centerLocation.lng,
          location.lat,
          location.lng
        )
      }))
      .filter(location => location.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
  }

  // Format distance for display
  static formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else if (distance < 10) {
      return `${distance.toFixed(1)}km`;
    } else {
      return `${Math.round(distance)}km`;
    }
  }

  // Get estimated travel time (mock implementation)
  static getEstimatedTravelTime(distance: number, mode: 'driving' | 'walking' | 'cycling' = 'driving'): string {
    const speeds = {
      driving: 30, // km/h in city
      walking: 5,  // km/h
      cycling: 15  // km/h
    };
    
    const timeInHours = distance / speeds[mode];
    const timeInMinutes = Math.round(timeInHours * 60);
    
    if (timeInMinutes < 60) {
      return `${timeInMinutes} min`;
    } else {
      const hours = Math.floor(timeInMinutes / 60);
      const minutes = timeInMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  // Validate location data
  static validateLocation(location: Partial<Location>): boolean {
    return !!(
      location.lat &&
      location.lng &&
      location.address &&
      location.lat >= -90 && location.lat <= 90 &&
      location.lng >= -180 && location.lng <= 180
    );
  }

  // Parse address components
  static parseAddress(address: string): {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  } {
    const parts = address.split(',').map(part => part.trim());
    const result: any = {};
    
    if (parts.length >= 1) result.street = parts[0];
    if (parts.length >= 2) result.city = parts[1];
    if (parts.length >= 3) result.state = parts[2];
    if (parts.length >= 4) result.zipCode = parts[3];
    if (parts.length >= 5) result.country = parts[4];
    
    return result;
  }
}

export const locationService = new LocationService(); 