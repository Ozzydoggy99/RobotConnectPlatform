import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Map, MapPin, Filter } from "lucide-react";

export default function MapsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("maps");
  
  const { data: maps, isLoading: isMapsLoading } = useQuery({
    queryKey: ["/api/maps"],
  });
  
  const { data: pois, isLoading: isPoisLoading } = useQuery({
    queryKey: ["/api/pois"],
  });
  
  // Filter maps based on search query
  const filteredMaps = maps?.filter((map: any) => 
    map.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    map.floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (map.building && map.building.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  // Filter POIs based on search query
  const filteredPois = pois?.filter((poi: any) => 
    poi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    poi.floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    poi.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Maps & POIs</h1>
        <p className="text-sm text-gray-600 mt-1">Manage maps and points of interest</p>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                type="text" 
                placeholder={`Search ${activeTab}...`} 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="h-10">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              
              <Button size="sm" className="h-10">
                <Plus className="h-4 w-4 mr-2" />
                {activeTab === "maps" ? "Add Map" : "Add POI"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="maps" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="maps">Maps</TabsTrigger>
          <TabsTrigger value="pois">Points of Interest</TabsTrigger>
        </TabsList>
        
        <TabsContent value="maps">
          <Card>
            <CardContent className="p-0">
              {isMapsLoading ? (
                <div className="p-4">
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : filteredMaps && filteredMaps.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Map Name</TableHead>
                      <TableHead>Area ID</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaps.map((map: any) => (
                      <TableRow key={map.id}>
                        <TableCell className="font-medium">{map.name}</TableCell>
                        <TableCell>{map.areaId}</TableCell>
                        <TableCell>{map.floor}</TableCell>
                        <TableCell>{map.building || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={map.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                            {map.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">View</Button>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No maps found matching your criteria</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="pois">
          <Card>
            <CardContent className="p-0">
              {isPoisLoading ? (
                <div className="p-4">
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : filteredPois && filteredPois.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>POI Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Coordinates</TableHead>
                      <TableHead>Area ID</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPois.map((poi: any) => (
                      <TableRow key={poi.id}>
                        <TableCell className="font-medium">{poi.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            poi.type === "charging" ? "bg-blue-100 text-blue-800" :
                            poi.type === "shelf" ? "bg-purple-100 text-purple-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {poi.type.charAt(0).toUpperCase() + poi.type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{poi.floor}</TableCell>
                        <TableCell>x: {poi.x.toFixed(2)}, y: {poi.y.toFixed(2)}{poi.yaw !== undefined ? `, yaw: ${poi.yaw}°` : ''}</TableCell>
                        <TableCell>{poi.areaId}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">View</Button>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No POIs found matching your criteria</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
