
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calculator, Layers, Scale } from 'lucide-react'; // Updated icon
import { useToast } from "@/hooks/use-toast";
import type { StructuralCode, LoadType, InputLoads, LoadFactors, CalculatedCombinationResult } from '@/types'; // Import new types
import { structuralCodes, getCodeById, loadTypeDetails } from '@/data/codes'; // Import codes and details

// Available load types based on our defined types
const availableLoadTypes: LoadType[] = Object.keys(loadTypeDetails) as LoadType[];

export function StructuralCalculations() {
    const { toast } = useToast();
    const [selectedCodeId, setSelectedCodeId] = useState<string>(structuralCodes[0].id);
    const [inputLoads, setInputLoads] = useState<InputLoads>({});
    const [loadFactors, setLoadFactors] = useState<LoadFactors>({});
    const [results, setResults] = useState<CalculatedCombinationResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const selectedCode = getCodeById(selectedCodeId);

    // Update default factors when code changes
    useEffect(() => {
        if (selectedCode) {
            setLoadFactors(selectedCode.defaultFactors);
            setInputLoads({}); // Reset input loads when code changes
            setResults(null);
            setError(null);
        }
    }, [selectedCodeId, selectedCode]);

    const handleInputChange = (type: LoadType, value: string) => {
        const numericValue = value === '' ? undefined : parseFloat(value);
        setInputLoads(prev => ({ ...prev, [type]: numericValue }));
        setError(null); // Clear error on input change
        setResults(null); // Clear result on input change
    };

    const handleFactorChange = (type: LoadType, value: string) => {
        const numericValue = value === '' ? undefined : parseFloat(value);
        setLoadFactors(prev => ({ ...prev, [type]: numericValue }));
         setError(null);
        setResults(null);
    };

     const parseLoad = (type: LoadType): number => {
        const value = inputLoads[type];
        // Allow zero or undefined loads, treat undefined/NaN as 0 for calculation
        if (value === undefined || isNaN(value)) {
            return 0;
        }
        // Can add validation for negative loads if necessary, but often needed for effects like uplift
        // if (value < 0) {
        //     throw new Error(`Load for ${loadTypeDetails[type].label} cannot be negative.`);
        // }
        return value;
    };

    const calculateCombinations = (): CalculatedCombinationResult[] => {
        if (!selectedCode) {
            throw new Error("No structural code selected.");
        }

        const calculatedResults: CalculatedCombinationResult[] = [];

        selectedCode.ulsCombinations.forEach(combo => {
            let totalFactoredLoad = 0;
            let detailsParts: string[] = [];

            // Iterate through the factors defined in the *combination*
            for (const loadKey in combo.factors) {
                 const type = loadKey as LoadType;
                 const factor = combo.factors[type];
                 const loadValue = parseLoad(type); // Get user input value for this type

                 if (factor !== undefined && factor !== 0 && loadValue !== 0) {
                    totalFactoredLoad += factor * loadValue;
                    detailsParts.push(`${factor.toFixed(2)}*${loadValue}`);
                 }
            }

             // Only add the result if it's non-zero or meaningful
             // You might adjust this logic based on whether zero-result combos are useful
             if (detailsParts.length > 0) {
                 calculatedResults.push({
                     combinationName: combo.name,
                     totalFactoredLoad: totalFactoredLoad,
                     details: detailsParts.join(' + ') + ` = ${totalFactoredLoad.toPrecision(4)}`
                 });
             }
        });

         // Sort results by total load descending (optional)
        calculatedResults.sort((a, b) => b.totalFactoredLoad - a.totalFactoredLoad);

        return calculatedResults;
    };

    const handleCalculation = () => {
        setError(null);
        setResults(null);

        try {
            if (!selectedCode) {
                throw new Error("Please select a structural code.");
            }
            const calculated = calculateCombinations();
            if (calculated.length === 0) {
                setError("No applicable load combinations found for the provided inputs.");
                 toast({
                    variant: "destructive",
                    title: "No Results",
                    description: "Enter load values to calculate combinations.",
                 });
            } else {
                setResults(calculated);
                toast({
                    title: "Calculation Successful",
                    description: `Calculated ${calculated.length} load combinations for ${selectedCode.name}.`,
                });
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
            toast({
                variant: "destructive",
                title: "Calculation Error",
                description: err.message || 'An unexpected error occurred.',
            });
        }
    };

    // --- Rendering ---

    const renderLoadInput = (type: LoadType) => {
        const details = loadTypeDetails[type];
        if (!details) return null;

        const defaultFactor = selectedCode?.defaultFactors[type];
        const showFactorInput = defaultFactor !== undefined; // Only show factor if code defines a default

        return (
            <div key={type} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center border-b pb-3 mb-3">
                 <div className="sm:col-span-1 space-y-1">
                     <Label htmlFor={`load-${type}`} title={details.description} className="font-medium">{details.label} ({type})</Label>
                      <p className="text-xs text-muted-foreground hidden sm:block">{details.description}</p>
                 </div>
                 <div className="sm:col-span-1">
                    <Label htmlFor={`load-${type}`} className="text-xs text-muted-foreground">Value ({details.unit})</Label>
                    <Input
                        id={`load-${type}`}
                        type="number"
                        step="any"
                        placeholder={`Enter ${type} value`}
                        value={inputLoads[type] ?? ''}
                        onChange={(e) => handleInputChange(type, e.target.value)}
                        aria-label={`${details.label} value`}
                    />
                 </div>
                 {showFactorInput && (
                     <div className="sm:col-span-1">
                         <Label htmlFor={`factor-${type}`} className="text-xs text-muted-foreground">Default Factor</Label>
                         <Input
                            id={`factor-${type}`}
                            type="number"
                            step="any"
                            placeholder="Factor"
                            value={loadFactors[type] ?? defaultFactor ?? ''}
                            onChange={(e) => handleFactorChange(type, e.target.value)}
                            aria-label={`Default factor for ${details.label}`}
                            className="bg-muted/50"
                            // Consider making this read-only if factors shouldn't be user-editable
                             readOnly // Make default factor read-only
                         />
                    </div>
                 )}
                  <p className="text-xs text-muted-foreground sm:hidden col-span-full">{details.description}</p>
            </div>
        );
    };

    return (
        // Changed max-w-3xl to max-w-4xl for potentially more inputs
        <Card className="w-full max-w-4xl mx-auto shadow-lg">
            <CardHeader>
                <div className="flex items-center space-x-2">
                    <Layers className="h-5 w-5 text-primary" /> {/* Icon for combinations */}
                    {/* Updated Card Title */}
                    <CardTitle>Load Combinations Calculator</CardTitle>
                </div>
                <CardDescription>Calculate factored loads based on selected structural codes (ULS).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="code-select">Structural Code</Label>
                    <Select onValueChange={setSelectedCodeId} value={selectedCodeId}>
                        <SelectTrigger id="code-select" aria-label="Select structural code">
                            <SelectValue placeholder="Select code" />
                        </SelectTrigger>
                        <SelectContent>
                            {structuralCodes.map(code => (
                                <SelectItem key={code.id} value={code.id}>{code.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Input Unfactored Loads</h3>
                    {availableLoadTypes.map(type => renderLoadInput(type))}
                </div>

                <Button onClick={handleCalculation} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Calculator className="mr-2 h-4 w-4" /> Calculate Combinations
                </Button>

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {results !== null && results.length > 0 && (
                    <Alert>
                        <Scale className="h-4 w-4" />
                        <AlertTitle>Factored Load Results (ULS)</AlertTitle>
                        <AlertDescription>
                            <ul className="list-none space-y-2 mt-2 max-h-60 overflow-y-auto pr-2"> {/* Added max height and scroll */}
                             {results.map((res, index) => (
                               <li key={index} className="border-b last:border-b-0 pb-1">
                                 <div className="flex justify-between items-center">
                                     <span className="font-medium">{res.combinationName}:</span>
                                     <span className="font-semibold text-lg">{res.totalFactoredLoad.toPrecision(4)}</span>
                                 </div>
                                 <p className="text-xs text-muted-foreground mt-1">{res.details}</p>
                               </li>
                             ))}
                           </ul>
                        </AlertDescription>
                         <p className="text-xs text-muted-foreground mt-2">Note: Loads with a value of 0 are omitted from the calculation details. Ensure units are consistent.</p>
                    </Alert>
                )}
                 {results !== null && results.length === 0 && !error && (
                     <Alert>
                        <AlertTitle>No Results</AlertTitle>
                        <AlertDescription>Please enter non-zero load values to calculate combinations for the selected code.</AlertDescription>
                    </Alert>
                 )}
            </CardContent>
        </Card>
    );
}
