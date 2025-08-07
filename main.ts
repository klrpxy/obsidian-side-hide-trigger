import { App, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

/**
 * Frontmatter 规则的接口
 */
interface FrontmatterRule {
	key: string;
	value: string;
}

/**
 * 插件的设置接口，用于存储用户配置
 */
interface MyPluginSettings {
	collapsePaths: string[];
	collapseFrontmatterRules: FrontmatterRule[];
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: MyPluginSettings = {
	collapsePaths: [],
	collapseFrontmatterRules: [{ key: 'hideside', value: 'true' }]
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	/**
	 * 插件加载时调用
	 */
	async onload() {
		// 加载用户保存的设置
		await this.loadSettings();

		// 添加设置界面
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// 注册文件打开事件
		this.registerEvent(
			this.app.workspace.on('file-open', this.handleFileOpen)
		);
	}

	/**
	 * 处理文件打开事件
	 * @param file - 当前打开的文件对象
	 */
	private handleFileOpen = (file: TFile | null) => {
		// 确保文件存在
		if (!file) {
			return;
		}

		// 如果没有设置项，则确保侧边栏展开
		if (this.settings.collapsePaths.length === 0 && this.settings.collapseFrontmatterRules.length === 0) {
			this.app.workspace.leftSplit.expand();
			return;
		}

		// 检查文件是否应该折叠侧边栏
		const shouldCollapse = this.shouldCollapseSidebar(file);

		if (shouldCollapse) {
			this.app.workspace.leftSplit.collapse();
		} else {
			this.app.workspace.leftSplit.expand();
		}
	};

	/**
	 * 判断文件是否应折叠侧边栏
	 * @param file - 当前打开的文件对象
	 */
	private shouldCollapseSidebar(file: TFile): boolean {
		// 检查路径或文件类型是否匹配
		const pathMatches = this.settings.collapsePaths.some(settingPath => {
			const trimmedPath = settingPath.trim();
			if (!trimmedPath) return false;

			// 如果设置项以 / 结尾，则认为是文件夹路径
			if (trimmedPath.endsWith('/')) {
				return file.path.startsWith(trimmedPath);
			}
			// 如果设置项以 . 开头，则认为是文件类型
			else if (trimmedPath.startsWith('.')) {
				return file.extension === trimmedPath.substring(1);
			}
			return false;
		});

		if (pathMatches) {
			return true;
		}

		// 检查 frontmatter 规则是否匹配
		const fileCache = this.app.metadataCache.getFileCache(file);
		if (fileCache?.frontmatter) {
			return this.settings.collapseFrontmatterRules.some(rule => {
				const frontmatterValue = fileCache.frontmatter?.[rule.key];
				return frontmatterValue !== undefined && String(frontmatterValue).trim() === rule.value.trim();
			});
		}

		return false;
	}

	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/**
 * 插件的设置界面
 */
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * 渲染设置界面的内容
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '侧边栏控制设置' });

		// 路径和文件类型设置
		new Setting(containerEl)
			.setName('要折叠的路径/文件类型')
			.setDesc('每行输入一个要自动折叠侧边栏的文件夹路径（以 / 结尾）或文件类型（例如：.pdf）。')
			.addTextArea(text => {
				// 设置输入框宽度为固定值
				text.inputEl.style.width = '250px';
				text.inputEl.style.minHeight = '100px';

				text
					.setPlaceholder('示例：\nattachments/\n.pdf\nnotes/project/')
					.setValue(this.plugin.settings.collapsePaths.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.collapsePaths = value.split('\n');
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl('h3', { text: '根据 Frontmatter 规则折叠' });

		// Frontmatter 规则设置
		this.plugin.settings.collapseFrontmatterRules.forEach((rule, index) => {
			const setting = new Setting(containerEl)
				.setClass('flex-row')
				.addText(text => text
					.setPlaceholder('键 (e.g. kanban-plugin)')
					.setValue(rule.key)
					.onChange(async (value) => {
						rule.key = value;
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder('值 (e.g. board)')
					.setValue(rule.value)
					.onChange(async (value) => {
						rule.value = value;
						await this.plugin.saveSettings();
					}))
				.addExtraButton(button => button
					.setIcon('trash')
					.setTooltip('删除此规则')
					.onClick(async () => {
						this.plugin.settings.collapseFrontmatterRules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display(); // 刷新设置界面
					}));
			setting.settingEl.style.display = 'flex';
			setting.controlEl.style.display = 'flex';
			setting.controlEl.style.gap = '8px';
		});

		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('添加新规则')
				.onClick(async () => {
					this.plugin.settings.collapseFrontmatterRules.push({ key: '', value: '' });
					await this.plugin.saveSettings();
					this.display();
				}));
	}
}