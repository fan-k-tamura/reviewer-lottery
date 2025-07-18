import type { Config } from "../config";
import type {
	AppliedRule,
	ReviewerSelectionResult,
	SelectionStep,
} from "../types/selection-types";

export class ReviewerSelector {
	constructor(private config: Config) {}

	/**
	 * Main reviewer selection logic
	 */
	selectReviewers(
		author: string,
		existingReviewers: string[] = [],
	): ReviewerSelectionResult {
		const authorGroup = this.getAuthorGroup(author);
		const appliedRule = this.determineApplicableRule(author, authorGroup);

		if (!appliedRule) {
			return {
				selectedReviewers: [],
				appliedRule: null,
				process: [],
			};
		}

		const process: SelectionStep[] = [];
		const selectedReviewers = this.executeSelection(
			appliedRule.rule,
			author,
			authorGroup,
			existingReviewers,
			process,
		);

		return {
			selectedReviewers,
			appliedRule,
			process,
		};
	}

	/**
	 * Get the group that the author belongs to
	 */
	getAuthorGroup(author: string): string | null {
		for (const group of this.config.groups) {
			if (group.usernames.includes(author)) {
				return group.name;
			}
		}
		return null;
	}

	/**
	 * Determine which rule applies to the author
	 */
	private determineApplicableRule(
		_author: string,
		authorGroup: string | null,
	): AppliedRule | null {
		const rules = this.config.selection_rules;
		if (!rules) return null;

		// Find applicable rule for author's group
		const applicableRule = rules.by_author_group?.find(
			(rule) => rule.group === authorGroup,
		);

		// Determine which rule to use based on author's group membership
		let fromClause: Record<string, number> | undefined;
		let ruleType: AppliedRule["type"];
		let ruleIndex: number | undefined;

		if (authorGroup === null) {
			// Author is not in any group
			fromClause = rules.non_group_members?.from || rules.default?.from;
			ruleType = rules.non_group_members?.from
				? "non_group_members"
				: "default";
		} else {
			// Author is in a group
			fromClause = applicableRule?.from || rules.default?.from;
			if (applicableRule) {
				ruleType = "by_author_group";
				ruleIndex = rules.by_author_group?.indexOf(applicableRule);
			} else {
				ruleType = "default";
			}
		}

		if (!fromClause) return null;

		return {
			type: ruleType,
			index: ruleIndex,
			rule: fromClause,
		};
	}

	/**
	 * Execute the selection process
	 */
	private executeSelection(
		fromClause: Record<string, number>,
		author: string,
		authorGroup: string | null,
		existingReviewers: string[],
		process: SelectionStep[],
	): string[] {
		let selected: string[] = [];
		let stepCounter = 1;

		for (const [groupKey, count] of Object.entries(fromClause)) {
			if (count <= 0) continue;

			const targetGroups = this.resolveGroupSelection(groupKey, authorGroup);
			const candidates = this.getCandidatesFromGroups(targetGroups);

			// Count existing reviewers from the target groups
			const existingFromGroups = existingReviewers.filter((reviewer) =>
				candidates.includes(reviewer),
			);

			// Calculate how many more reviewers we need from this group
			const remainingNeeded = Math.max(0, count - existingFromGroups.length);

			const picks = this.pickRandom(
				candidates,
				remainingNeeded,
				selected.concat(author, ...existingReviewers),
			);

			// Record the selection step
			process.push({
				step: stepCounter++,
				description: `Select ${remainingNeeded} from ${groupKey} (${picks.length} selected)`,
				groupKey,
				candidates,
				required: remainingNeeded,
				selected: picks,
			});

			selected = selected.concat(picks);
		}

		return selected;
	}

	/**
	 * Resolve group selection based on group key
	 */
	resolveGroupSelection(
		groupKey: string,
		_authorGroup: string | null,
	): string[] {
		if (groupKey === "*") {
			// All groups
			return this.config.groups.map((g) => g.name);
		}

		if (groupKey.startsWith("!")) {
			// Exclude specific group(s) - support comma-separated list
			const excludeGroups = groupKey
				.substring(1)
				.split(",")
				.map((g) => g.trim());
			return this.config.groups
				.map((g) => g.name)
				.filter((name) => !excludeGroups.includes(name));
		}

		// Specific group
		return [groupKey];
	}

	/**
	 * Get candidates from multiple groups
	 */
	getCandidatesFromGroups(groupNames: string[]): string[] {
		const candidates: string[] = [];

		for (const groupName of groupNames) {
			const group = this.config.groups.find((g) => g.name === groupName);
			if (group) {
				candidates.push(...group.usernames);
			}
		}

		return candidates;
	}

	/**
	 * Pick random items from a list (using Math.random for production)
	 */
	pickRandom(items: string[], n: number, ignore: string[]): string[] {
		const picks: string[] = [];
		const candidates = items.filter((item) => !ignore.includes(item));

		while (picks.length < n && candidates.length > 0) {
			const random = Math.floor(Math.random() * candidates.length);
			const pick = candidates.splice(random, 1)[0];

			if (!picks.includes(pick)) picks.push(pick);
		}

		return picks;
	}

	/**
	 * Deterministic random selection for testing
	 */
	pickRandomDeterministic(
		items: string[],
		n: number,
		ignore: string[],
		seed = 0,
	): string[] {
		const picks: string[] = [];
		const candidates = items.filter((item) => !ignore.includes(item));

		// Simple seeded random number generator
		let currentSeed = seed;
		const seededRandom = () => {
			currentSeed = (currentSeed * 9301 + 49297) % 233280;
			return currentSeed / 233280;
		};

		while (picks.length < n && candidates.length > 0) {
			const random = Math.floor(seededRandom() * candidates.length);
			const pick = candidates.splice(random, 1)[0];

			if (!picks.includes(pick)) picks.push(pick);
		}

		return picks;
	}

	/**
	 * Public method for testing: Select reviewers with rules
	 */
	selectReviewersWithRules(
		author: string,
		existingReviewers: string[],
	): string[] {
		const result = this.selectReviewers(author, existingReviewers);
		return result.selectedReviewers;
	}

	/**
	 * Public method for testing: Select from multiple groups
	 */
	selectFromMultipleGroups(
		fromClause: Record<string, number>,
		author: string,
		authorGroup: string | null,
		existingReviewers: string[],
	): string[] {
		const process: SelectionStep[] = [];
		return this.executeSelection(
			fromClause,
			author,
			authorGroup,
			existingReviewers,
			process,
		);
	}
}
