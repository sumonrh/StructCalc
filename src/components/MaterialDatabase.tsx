'use client';

import { useState } from 'react';
import type { Material } from '@/types';
import { initialMaterials } from '@/data/materials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package } from 'lucide-react'; // Icon for materials/database

type MaterialCategory = 'All' | 'Steel' | 'Concrete' | 'Timber' | 'Custom';

export function MaterialDatabase() {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials); // Later, fetch/manage this state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<MaterialCategory>('All');

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'All' || material.category === activeTab;
    return matchesSearch && matchesTab;
  });

  // Helper to display properties nicely
  const renderProperties = (material: Material) => {
    return Object.entries(material.properties)
      .map(([key, value]) => {
        if (value === undefined || value === null) return null;
        // Convert camelCase to Title Case for display
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        // Basic unit annotation (can be improved)
        let unit = '';
         if (material.unitSystem === 'Metric') {
            if (key === 'youngsModulus') unit = 'GPa';
            else if (key.includes('Strength')) unit = 'MPa';
            else if (key === 'density') unit = 'kg/m³';
            else if (key === 'thermalExpansionCoefficient') unit = 'x10⁻⁶ /°C';
         } else { // Imperial
             if (key === 'youngsModulus') unit = 'ksi';
            else if (key.includes('Strength')) unit = 'ksi';
            else if (key === 'density') unit = 'lb/ft³';
            else if (key === 'thermalExpansionCoefficient') unit = 'x10⁻⁶ /°F';
         }

        return (
          <div key={key} className="text-xs">
            <span className="font-medium">{formattedKey}:</span> {value} {unit}
          </div>
        );
      })
      .filter(Boolean); // Remove null entries
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader>
         <div className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle>Material Properties Database</CardTitle>
        </div>
        <CardDescription>Reference properties for common structural materials.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-4">
           <Input
            type="search"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            aria-label="Search material database"
          />
           {/* Add Button for "Add Custom Material" could go here */}
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MaterialCategory)}>
          <TabsList>
            <TabsTrigger value="All">All</TabsTrigger>
            <TabsTrigger value="Steel">Steel</TabsTrigger>
            <TabsTrigger value="Concrete">Concrete</TabsTrigger>
            <TabsTrigger value="Timber">Timber</TabsTrigger>
            {/* <TabsTrigger value="Custom">Custom</TabsTrigger> */}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
             <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Properties</TableHead>
                    <TableHead className="text-right">Unit System</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.length > 0 ? (
                    filteredMaterials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>
                           <Badge variant={
                               material.category === 'Steel' ? 'secondary' :
                               material.category === 'Concrete' ? 'outline' :
                               material.category === 'Timber' ? 'default' : 'destructive' // Example styling
                             } className="capitalize">
                             {material.category}
                           </Badge>
                        </TableCell>
                        <TableCell>{renderProperties(material)}</TableCell>
                         <TableCell className="text-right">
                            <Badge variant="secondary">{material.unitSystem}</Badge>
                         </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No materials found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
