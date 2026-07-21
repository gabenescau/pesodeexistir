"use client";;
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export function FrequencyToggle({
    frequency,
    setFrequency,
    frequencies = ["monthly", "yearly"],
    ...props
}) {
	return (
        <div
            className={cn(
                "mx-auto flex w-fit rounded-xl border bg-card p-1 shadow-xs",
                props.className
            )}
            {...props}>
            {frequencies.map((freq) => (
				<button
                    className="relative px-4 py-1 text-sm capitalize"
                    key={freq}
                    onClick={() => setFrequency(freq)}
                    type="button">
					<span className="relative z-10">{freq}</span>
					{frequency === freq && (
						<motion.span
                            className="absolute inset-0 z-10 rounded-xl bg-background mix-blend-difference dark:bg-foreground"
                            layoutId="frequency"
                            transition={{ type: "spring", duration: 0.4 }} />
					)}
				</button>
			))}
        </div>
    );
}
