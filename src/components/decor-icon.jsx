import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import { Plus } from "@phosphor-icons/react";

const DecorIconVariants = cva(
    "pointer-events-none absolute z-1 size-5 shrink-0 text-muted-foreground",
    {
		variants: {
			position: {
				"top-left":
					"top-0 left-0 -translate-x-[calc(50%+0.5px)] -translate-y-[calc(50%+0.5px)]",
				"top-right":
					"top-0 right-0 translate-x-[calc(50%+0.5px)] -translate-y-[calc(50%+0.5px)]",
				"bottom-right":
					"right-0 bottom-0 translate-x-[calc(50%+0.5px)] translate-y-[calc(50%+0.5px)]",
				"bottom-left":
					"bottom-0 left-0 -translate-x-[calc(50%+0.5px)] translate-y-[calc(50%+0.5px)]",
			},
		},
		defaultVariants: {
			position: "top-left",
		},
	}
);

export function DecorIcon({
    position,
    className,
    ...props
}) {
	return (
        <Plus
            aria-hidden="true"
            className={cn(DecorIconVariants({ position, className }))}
            {...props}
        />
    );
}
