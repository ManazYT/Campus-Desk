# Design Tooling Notes

This note records the public resources reviewed for the Campus Desk redesign and how their guidance was adapted. These are development-time instructions, not website runtime libraries.

## Resources

1. **Taste Skill**  
   https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md  
   Used for reading the product and audience first, selecting deliberate design dials, auditing an existing interface before redesigning it, and avoiding generic visual defaults.

2. **Vercel Web Design Guidelines**  
   https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md  
   https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md  
   Used for semantic navigation, skip links, focus visibility, reduced motion, safe areas, theme-aware native controls, and preventing overflow.

3. **Image to Code**  
   https://github.com/Leonxlnx/taste-skill/blob/main/skills/image-to-code-skill/SKILL.md  
   Used as a reminder to derive reusable tokens and concrete layout rules from visual evidence before implementing sections. For this preserve-first update, the existing live app and its source were the design baseline; no new mockup or image asset was required.

4. **Awesome DESIGN.md**  
   https://github.com/VoltAgent/awesome-design-md  
   Used for the format of a project-owned design system. Campus Desk has its own `DESIGN.md` rather than copying another company's identity.

5. **Playwright CLI**  
   https://github.com/microsoft/playwright-cli  
   Its guidance informed the viewport and interaction checks. The CLI itself could not be downloaded into this isolated runtime, so deployment verification uses the available AppDeploy browser QA rather than claiming a Playwright CLI run.

## Applied changes

- Consolidated the competing global theme token blocks into one dark-first token source and one light-mode override.
- Removed duplicated dashboard metrics.
- Corrected malformed top-bar nesting and improved navigation semantics.
- Added skip navigation, theme-color synchronization, visible focus states, and reduced-motion handling.
- Made the six-item bottom navigation a single responsive row with safe-area padding.
- Added QA expectations for duplicate metrics, theme consistency, and narrow-screen usability.
