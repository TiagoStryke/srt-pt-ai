import type { Chunk } from "@/types";
import { FC } from "react";
import "tailwindcss/tailwind.css";

const Timestamp: FC<Chunk & { originalText?: string }> = ({
	index,
	start,
	end,
	text,
	originalText,
}) => {
	const formatTimestamp = (timestamp: string) => {
		let [hours, minutes, secondsWithMs] = timestamp.split(":");
		const [seconds, ms] = secondsWithMs.split(",");

		return `${minutes}:${seconds}.${ms[0]}`;
	};

	return (
		<div className="flex">
			<div className="flex flex-col items-center">
				<div className="flex items-center mb-1">
					<span className="text-xl">⏲</span>
					<p className="ml-2 text-gray-400 dark:text-gray-500">{formatTimestamp(start)}</p>
				</div>
				<div className="flex items-center">
					<span className="text-xl">⏲</span>
					<p className="ml-2 text-gray-400 dark:text-gray-500">{formatTimestamp(end)}</p>
				</div>
			</div>
			<div className="flex-grow flex gap-4 ml-4">
				{originalText && (
					<textarea
						className="flex-grow h-full bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-gray-500 dark:text-gray-400 border dark:border-gray-700"
						value={originalText}
						readOnly
					/>
				)}
				<textarea
					className="flex-grow h-full bg-gray-200 dark:bg-gray-700 p-2 rounded-lg dark:text-gray-200 border dark:border-gray-600"
					value={text}
					readOnly
				/>
			</div>
		</div>
	);
};

export default Timestamp;
