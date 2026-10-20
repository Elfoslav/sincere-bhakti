export type PrivacyPolicySection = {
	heading: string;
	paragraphs?: string[];
	items?: string[];
};

export const krishnaChaitanyaMandirPrivacy = {
	title: "Privacy Policy",
	appName: "Krishna Chaitanya Mandir",
	lastUpdated: "October 20, 2026",
	intro: [
		"Krishna Chaitanya Mandir (“we,” “our,” or “the App”) is a mobile application providing information about temple activities, spiritual events, news, and related devotional content.",
		"We respect your privacy and are committed to protecting your personal information.",
		"This Privacy Policy explains what information may be collected, how it is used, and your rights regarding your personal data.",
	],
	sections: [
		{
			heading: "2. Information We Collect",
			paragraphs: [
				"Public Users",
				"You can browse publicly available news, events, and other content without creating an account.",
				"We do not require public users to provide their name, email address, or other personal information to access public content.",
				"However, technical information such as IP addresses, device information, and application activity may be processed by our infrastructure providers to deliver and secure the App.",
				"Administrator Accounts",
				"Authorized administrators may be required to provide:",
			],
			items: [
				"Email address",
				"Authentication credentials",
				"Account identification and authorization information",
				"Information necessary for account security and administration",
				"Passwords are handled by our authentication provider and are not stored by us in plaintext.",
			],
		},
		{
			heading: "3. How We Use Information",
			paragraphs: ["Information is processed for the following purposes:", "We do not sell personal information."],
			items: [
				"Providing access to news, events, and devotional content",
				"Authenticating and managing administrator accounts",
				"Maintaining the security and reliability of the App",
				"Delivering notifications, where enabled",
				"Diagnosing technical problems",
				"Preventing unauthorized access or misuse",
			],
		},
		{
			heading: "4. Third-Party Services",
			paragraphs: [
				"Supabase — Used for database storage, authentication, and application backend functionality.",
				"Privacy Policy: https://supabase.com/privacy",
				"Cloudflare — May be used for storing and delivering images and other media files.",
				"Privacy Policy: https://www.cloudflare.com/privacypolicy/",
				"Expo / Notification Services — If push notifications are enabled, notification tokens and related technical information may be processed by Expo and the relevant mobile platform's notification services.",
				"Privacy Policy: https://expo.dev/privacy",
				"These providers process information according to their applicable privacy policies and service agreements.",
			],
		},
		{
			heading: "5. Push Notifications",
			paragraphs: [
				"If the App offers push notifications, users may choose whether to allow them through their device settings.",
				"Notification delivery may require processing device push tokens and related technical information.",
				"You can disable notifications at any time through your device settings.",
			],
		},
		{
			heading: "6. Data Sharing",
			paragraphs: [
				"We do not sell or rent personal information to advertisers.",
				"Information may be shared with service providers only as necessary to operate, maintain, and secure the App, or where required by applicable law.",
			],
		},
		{
			heading: "7. Data Retention and Deletion",
			paragraphs: [
				"Administrator account information is retained for as long as necessary to maintain authorized access and fulfill legitimate operational requirements.",
				"When an administrator account is no longer required, the associated personal information may be deleted or anonymized, subject to applicable legal, security, and operational retention requirements.",
				"Users may request access to or deletion of their personal information by contacting us at the email address below.",
			],
		},
		{
			heading: "8. Data Security",
			paragraphs: [
				"We use reasonable technical and organizational safeguards designed to protect information against unauthorized access, alteration, disclosure, or destruction.",
				"However, no method of electronic storage or transmission is completely secure.",
			],
		},
		{
			heading: "9. Children's Privacy",
			paragraphs: [
				"The App provides devotional and educational content that may be suitable for a broad audience, including families.",
				"Public content can be accessed without creating an account.",
				"We do not knowingly request personal information directly from children through public account registration.",
				"If we become aware that personal information from a child has been collected inappropriately, we will take appropriate steps to address the situation.",
			],
		},
		{
			heading: "10. International Data Processing",
			paragraphs: [
				"Our service providers may process or store information in countries other than the country where a user resides.",
				"Where applicable, we take appropriate measures to protect personal data in accordance with relevant data protection laws.",
			],
		},
		{
			heading: "11. Your Privacy Rights",
			paragraphs: ["Depending on your location and applicable law, you may have rights to:", "To exercise these rights, please contact us."],
			items: [
				"Request access to your personal information",
				"Request correction of inaccurate information",
				"Request deletion of your personal information",
				"Object to or restrict certain processing",
				"Withdraw consent where processing is based on consent",
			],
		},
		{
			heading: "12. Changes to This Privacy Policy",
			paragraphs: [
				"We may update this Privacy Policy to reflect changes in our App, services, or legal requirements.",
				"Any updates will be published on this page with a revised “Last updated” date.",
			],
		},
		{
			heading: "13. Contact Us",
			paragraphs: [
				"If you have questions about this Privacy Policy or how your information is handled, please contact:",
				"App: Krishna Chaitanya Mandir",
				"Developer: Sincere Bhakti",
				"Email: info@sincerebhakti.com",
				"Website: https://sincerebhakti.com",
				"Data controller / legal operator: [Insert legal name and country of establishment]",
			],
		},
	] satisfies PrivacyPolicySection[],
} as const;
