import i18next, { TFunction } from "i18next";
import { formatAmount, formatCraftingSpeed, formatCraftingTime, formatEnergyUsage, formatMachineSlots } from "./format";

describe("format", (): void => {
    describe("formatAmount", (): void => {
        test.each([
            [42, "42x"],
            [42.123, "42.1x"],
            [0.42, "42%"],
            [0.42132, "42.1%"],
            [42000, "42k"],
            [42123, "42.1k"],
            [42000000, "42M"],
            [42123456, "42.1M"],
        ])("%f", (amount: number, expectedResult: string): void => {
            const result = formatAmount(amount);

            expect(result).toBe(expectedResult);
        });
    });

    describe("formatCraftingSpeed", (): void => {
        test.each([
            [42, "42x"],
            [42.123, "42.12x"],
        ])("%f", (craftingSpeed: number, expectedResult: string): void => {
            const result = formatCraftingSpeed(craftingSpeed);

            expect(result).toBe(expectedResult);
        });
    });

    describe("formatCraftingTime", (): void => {
        test.each([
            [0, ""],
            [12.34, "12.34s"],
            [12.3456, "12.35s"],
            [720, "12min"],
            [1337, "22.28min"],
            [54000, "15h"],
            [54321, "15.09h"],
            [123456, "∞"],
        ])("%f", (craftingTime: number, expectedResult: string): void => {
            const result = formatCraftingTime(craftingTime);

            expect(result).toBe(expectedResult);
        });
    });

    describe("formatEnergyUsage", (): void => {
        test.each([
            [42, "W", "42W"],
            [42.123, "kW", "42.123kW"],
            [42.123456, "MW", "42.123MW"],
        ])("%f %s", (energyUsage: number, energyUsageUnit: string, expectedResult: string): void => {
            const result = formatEnergyUsage(energyUsage, energyUsageUnit);

            expect(result).toBe(expectedResult);
        });
    });

    describe("formatMachineSlots", (): void => {
        test.each([
            [42, "42"],
            [0, "none"],
            [255, "unlimited"],
        ])("%d", (slots: number, expectedResult: string): void => {
            const mockedFunction = (key: string): string => {
                const values: { [key: string]: string } = {
                    "recipe-details.machine.none": "none",
                    "recipe-details.machine.unlimited": "unlimited",
                };
                return values[key] || "";
            };
            // i18next's TFunction is a heavily overloaded, branded type; the test only
            // needs the plain (key) => string behaviour, so cast the stub through unknown.
            jest.spyOn(i18next, "t").mockImplementation(mockedFunction as unknown as TFunction);

            const result = formatMachineSlots(slots);

            expect(result).toBe(expectedResult);
        });
    });
});
