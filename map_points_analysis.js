/**
 * Script to analyze robot map points retrieved from the robot API
 */
import fs from 'fs';

try {
  // Read the points data
  const data = JSON.parse(fs.readFileSync('robot_points.json'));
  
  console.log('MAP POINTS SUMMARY:');
  console.log('Total Points:', data.points.length);
  console.log('Floor:', data.floor);
  console.log('Robot ID:', data.robotId);
  
  console.log('\nPOINT TYPES:');
  const types = {};
  data.points.forEach(p => { 
    types[p.type] = (types[p.type] || 0) + 1;
  });
  
  Object.entries(types).forEach(([type, count]) => {
    console.log(`- ${type}: ${count}`);
  });
  
  console.log('\nNAMED POINTS:');
  data.points.filter(p => p.name && !p.name.startsWith('6823a')).forEach(p => {
    console.log(`- ${p.name} (${p.type}): [${p.x.toFixed(2)}, ${p.y.toFixed(2)}], yaw: ${p.yaw}`);
  });
  
  // Identify potential charging station
  const chargers = data.points.filter(p => p.type.includes('charger'));
  console.log('\nCHARGING STATIONS:');
  chargers.forEach(c => {
    console.log(`- ${c.name}: [${c.x.toFixed(2)}, ${c.y.toFixed(2)}], yaw: ${c.yaw}`);
  });
  
  // Identify docking points
  const dockingPoints = data.points.filter(p => p.type === 'docking');
  console.log('\nDOCKING POINTS:');
  dockingPoints.forEach(d => {
    console.log(`- ${d.name}: [${d.x.toFixed(2)}, ${d.y.toFixed(2)}], yaw: ${d.yaw}`);
  });
  
  // Identify rack points
  const rackPoints = data.points.filter(p => p.type.includes('rack'));
  console.log('\nRACK POINTS:');
  rackPoints.forEach(r => {
    console.log(`- ${r.name}: [${r.x.toFixed(2)}, ${r.y.toFixed(2)}], yaw: ${r.yaw}`);
  });
  
} catch (error) {
  console.error('Error analyzing points:', error);
}