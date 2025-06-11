"use client";

import { libre, playfair } from "@/fonts";

import Form from "@/components/Form";
import ThemeToggle from "@/components/ThemeToggle";

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

export default function Home() {
	return (		<div className="p-4 w-full max-w-5xl mx-auto">
			<div className="py-8">
				{/* Header with title and theme toggle */}
				<div className="flex justify-between items-start mb-6">
					<div className="text-center flex-1">
						<h1
							className={classNames(
"font-black text-4xl text-[#444444] dark:text-gray-200 mb-4",
playfair.className
)}
						>
							🔥 SRT PT AI
						</h1>
					</div>
					<div className="flex-shrink-0">
						<ThemeToggle />
					</div>
				</div>
				
				{/* Subtitle and description - centered */}
				<div className="text-center">
					<h2 className={classNames("text-2xl text-gray-600 dark:text-gray-400 mb-2", libre.className)}>
						AI-Powered Subtitle Translation
					</h2>
					<p className="text-gray-500 dark:text-gray-500 text-lg">
						Translate your SRT subtitle files to Brazilian Portuguese using Google Gemini AI
					</p>
				</div>
			</div>

			<div className="mt-8">
				<Form />
			</div>

			<div className="text-center mt-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
				<h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
					✨ Features
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
					<div className="flex items-center gap-2">
						<span className="text-green-500">🤖</span>
						<span>Google Gemini 2.0 Flash AI</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-blue-500">⚡</span>
						<span>Quota-Aware Processing</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-purple-500">🔄</span>
						<span>Automatic Retry Logic</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-orange-500">📊</span>
						<span>Real-time Progress</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-red-500">🛡️</span>
						<span>Rate Limit Handling</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-teal-500">🎯</span>
						<span>Batch Processing</span>
					</div>
				</div>
			</div>
		</div>
	);
}
