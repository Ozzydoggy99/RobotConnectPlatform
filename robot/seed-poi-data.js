/**
 * Seed POI data into the database based on real-world robot layouts
 * This script helps populate initial POI data for robots
 */
import { storage } from '../storage';

/**
 * Seed Floor1 POIs for a specific robot
 * These points are based on typical warehouse layouts with charging, shelving and pickup/dropoff areas
 */
export async function seedFloor1POIs(robotId) {
  try {
    console.log(`Seeding POIs for robot ${robotId} on Floor1...`);
    
    // Real-world POI layout for a warehouse floor
    const points = [
      {
        name: "Floor1_charger",
        type: "charger",
        poiId: "charger_001",
        x: 10.5,
        y: 5.2,
        yaw: 0,
        areaId: "Floor1",
        floor: "Floor1",
        metadata: {
          stopRadius: 0.5,
          dockingRadius: 0.8
        }
      },
      {
        name: "Floor1_dropoff",
        type: "dropoff",
        poiId: "dropoff_001",
        x: 15.3,
        y: 8.7,
        yaw: 90,
        areaId: "Floor1",
        floor: "Floor1",
        metadata: {
          stopRadius: 0.5
        }
      },
      {
        name: "Floor1_pickup",
        type: "pickup",
        poiId: "pickup_001",
        x: 20.1,
        y: 12.4,
        yaw: 180,
        areaId: "Floor1",
        floor: "Floor1",
        metadata: {
          stopRadius: 0.5
        }
      },
      {
        name: "Floor1_shelf1",
        type: "shelf",
        poiId: "shelf_001",
        x: 25.8,
        y: 7.9,
        yaw: 270,
        areaId: "Floor1",
        floor: "Floor1",
        metadata: {
          stopRadius: 0.3
        }
      },
      {
        name: "Floor1_shelf2",
        type: "shelf",
        poiId: "shelf_002",
        x: 30.2,
        y: 7.9,
        yaw: 270,
        areaId: "Floor1",
        floor: "Floor1",
        metadata: {
          stopRadius: 0.3
        }
      },
      {
        name: "Floor1_load",
        type: "loading",
        poiId: "load_001",
        x: 35.6,
        y: 15.3,
        yaw: 0,
        areaId: "Floor1",
        floor: "Floor1",
        metadata: {
          stopRadius: 0.6
        }
      },
      {
        name: "Floor1_load_docking",
        type: "docking",
        poiId: "dock_001",
        x: 35.6,
        y: 16.8,
        yaw: 0,
        areaId: "Floor1",
        floor: "Floor1",
        metadata: {
          stopRadius: 0.4,
          dockingRadius: 0.7
        }
      }
    ];
    
    // Store each point in the database
    let createdCount = 0;
    for (const point of points) {
      try {
        await storage.createPoi(point);
        createdCount++;
      } catch (error) {
        // If the point already exists, log it but continue
        if (error.message && error.message.includes('duplicate')) {
          console.log(`POI ${point.name} already exists, skipping`);
        } else {
          console.error(`Error creating POI ${point.name}:`, error);
        }
      }
    }
    
    console.log(`Successfully seeded ${createdCount} POIs for robot ${robotId} on Floor1`);
    return { success: true, count: createdCount };
  } catch (error) {
    console.error(`Error seeding POIs for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Create an API endpoint to seed POI data for testing
 */
export async function seedRobotPOIs(robotId) {
  try {
    // Currently we only support Floor1
    const result = await seedFloor1POIs(robotId);
    
    // Add additional floors as needed with separate functions
    
    return result;
  } catch (error) {
    console.error(`Error seeding robot POIs:`, error);
    throw error;
  }
}